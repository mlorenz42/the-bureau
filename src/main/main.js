const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const os = require('os');
const http = require('http');
const pty = require('node-pty');
const { execFile } = require('child_process');
const { createRoster } = require('./roster');
const { pollHerdr, watchHerdr, HERDR } = require('./herdr');
const { createSpeaker } = require('./speaker');
const { loadSettings } = require('./settings');
const I18n = require('../shared/i18n');

const HOOK_PORT = Number(process.env.OFFICE_HOOK_PORT || 47321);
const FALLBACK_POLL_MS = 5000;
const EVENT_DEBOUNCE_MS = 120;

let window;
let roster;
let speaker;
let settings;
let i18n = I18n.create('en');

// German when macOS prefers German, English otherwise; the window asks for it on load
function uiLanguage() {
  return process.env.OFFICE_LANG || app.getPreferredSystemLanguages()[0] || app.getLocale();
}
ipcMain.on('i18n:lang', (event) => {
  event.returnValue = i18n.lang;
});
const terminals = new Map();

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}

function createWindow() {
  window = new BrowserWindow({
    width: 1500,
    height: 950,
    backgroundColor: '#1d1f24',
    title: 'The Bureau',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });
  window.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    if (level === 'warning' || level === 'error') console.error(`[renderer] ${message} (${sourceId}:${lineNumber})`);
  });
  // The window only ever shows the app's own page: no navigation away, no new windows.
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (process.env.OFFICE_SCREENSHOT) captureAndQuit(process.env.OFFICE_SCREENSHOT);
}

function announcementToggle(label, key) {
  return {
    label,
    type: 'checkbox',
    checked: settings.get(key),
    click: (item) => settings.set(key, item.checked),
  };
}

function paneToggle(label, pane, key) {
  return {
    id: `pane-${pane}`,
    label,
    type: 'checkbox',
    checked: true,
    accelerator: `CmdOrCtrl+${key}`,
    click: () => send('layout:command', `toggle-${pane}`),
  };
}

// the renderer owns the layout; it reports what is visible so the checkboxes match
ipcMain.on('layout:state', (_event, state) => {
  const menu = Menu.getApplicationMenu();
  for (const pane of ['herdr', 'shell', 'office']) {
    const item = menu?.getMenuItemById(`pane-${pane}`);
    if (item) item.checked = Boolean(state[pane]);
  }
});

function showShortcuts() {
  dialog.showMessageBox(window, { message: i18n.t('shortcutsTitle'), detail: i18n.t('shortcuts').join('\n'), buttons: ['OK'] });
}

function installMenu() {
  const shellCommand = (command) => () => send('shell:command', command);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      {
        label: i18n.t('menuShell'),
        submenu: [
          { label: i18n.t('newTab'), accelerator: 'CmdOrCtrl+T', click: shellCommand('new') },
          { label: i18n.t('closeTab'), accelerator: 'CmdOrCtrl+W', click: shellCommand('close') },
          { type: 'separator' },
          { label: i18n.t('nextTab'), accelerator: 'Ctrl+Tab', click: shellCommand('next') },
          { label: i18n.t('previousTab'), accelerator: 'Ctrl+Shift+Tab', click: shellCommand('previous') },
          { label: i18n.t('nextTab'), accelerator: 'CmdOrCtrl+Shift+]', click: shellCommand('next'), visible: false },
          { label: i18n.t('previousTab'), accelerator: 'CmdOrCtrl+Shift+[', click: shellCommand('previous'), visible: false },
        ],
      },
      {
        label: i18n.t('menuView'),
        submenu: [
          paneToggle('Herdr', 'herdr', '1'),
          paneToggle(i18n.t('paneShell'), 'shell', '2'),
          paneToggle('Office', 'office', '3'),
          { type: 'separator' },
          { label: i18n.t('defaultLayout'), accelerator: 'CmdOrCtrl+0', click: () => send('layout:command', 'reset') },
          { type: 'separator' },
          {
            label: i18n.t('followFocus'),
            type: 'checkbox',
            checked: settings.get('followFocus'),
            click: (item) => {
              settings.set('followFocus', item.checked);
              send('follow-focus', item.checked);
            },
          },
          {
            label: i18n.t('animations'),
            type: 'checkbox',
            checked: settings.get('animations'),
            click: (item) => {
              settings.set('animations', item.checked);
              send('animations', item.checked);
            },
          },
        ],
      },
      {
        label: i18n.t('menuAnnouncements'),
        submenu: [
          announcementToggle(i18n.t('announceDone'), 'announceDone'),
          announcementToggle(i18n.t('announceBlocked'), 'announceBlocked'),
        ],
      },
      { role: 'windowMenu' },
      { role: 'help', submenu: [{ label: i18n.t('shortcutsMenu'), accelerator: 'CmdOrCtrl+/', click: showShortcuts }] },
    ]),
  );
}

function captureAndQuit(target) {
  setTimeout(async () => {
    const image = await window.webContents.capturePage();
    require('fs').writeFileSync(target, image.toPNG());
    app.quit();
  }, Number(process.env.OFFICE_SCREENSHOT_DELAY || 6000));
}

function spokenTask(task) {
  return (task || '').replace(/[/\\|<>#_*`~]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function userIsLookingAt(agent) {
  return agent.focused && window && !window.isDestroyed() && window.isFocused();
}

function announceTransitions(transitions) {
  for (const { agent, from, to } of transitions) {
    const quiet = userIsLookingAt(agent);
    if (from === 'working' && (to === 'done' || to === 'idle')) {
      const truth = agent.name === 'Agent Mulder' && Math.random() < 0.25;
      if (!quiet && settings.get('announceDone')) speaker.announce(agent.voice, 'done', agent.name, spokenTask(agent.task), { truth });
      send('bubble', { key: agent.key, text: i18n.t('bubbleDone') });
    } else if (to === 'blocked' && from !== 'blocked') {
      if (!quiet && settings.get('announceBlocked')) speaker.announce(agent.voice, 'blocked', agent.name, spokenTask(agent.task));
      send('bubble', { key: agent.key, text: i18n.t('bubbleBlocked') });
    }
  }
}

let refreshing = false;
let refreshAgain = false;
let refreshTimer = null;
let herdrWatch = null;

async function refresh() {
  if (refreshing) {
    refreshAgain = true;
    return;
  }
  refreshing = true;
  try {
    const herdrAgents = await pollHerdr();
    const transitions = roster.update(herdrAgents);
    announceTransitions(transitions);
    send('agents', roster.snapshot());
    herdrWatch?.watchPanes(roster.paneIds());
  } catch (error) {
    send('herdr-error', String(error.message || error));
  } finally {
    refreshing = false;
  }
  if (refreshAgain) {
    refreshAgain = false;
    refresh();
  }
}

function scheduleRefresh(delay) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refresh().finally(() => scheduleRefresh(FALLBACK_POLL_MS));
  }, delay);
}

function startHookServer() {
  const server = http.createServer((request, response) => {
    if (request.method !== 'POST') {
      response.writeHead(405).end();
      return;
    }
    // Only the hook's curl call is accepted. A web page in a browser always sends an Origin header,
    // and it cannot send application/json to another site without a preflight we never answer.
    const json = (request.headers['content-type'] || '').startsWith('application/json');
    if (request.headers.origin || !json) {
      response.writeHead(403).end();
      request.resume();
      return;
    }
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on('end', () => {
      response.writeHead(204).end();
      try {
        handleHook(JSON.parse(body));
      } catch {
        // malformed hook payloads are ignored; the hook command never blocks Claude
      }
    });
  });
  server.on('error', (error) => send('herdr-error', i18n.t('hookPortError', { port: HOOK_PORT, message: error.message })));
  server.listen(HOOK_PORT, '127.0.0.1');
}

function handleHook(event) {
  const name = event.hook_event_name;
  if (name === 'SubagentStart' && event.agent_id) {
    const subagent = roster.addSubagent(event.session_id, event.agent_id, event.agent_type, event.transcript_path);
    if (subagent) send('agents', roster.snapshot());
  } else if (name === 'SubagentStop' && event.agent_id) {
    if (roster.removeSubagent(event.agent_id)) send('agents', roster.snapshot());
  }
}

const TERMINAL_APP_FONT = `
ObjC.import('AppKit');
const defaults = $.NSUserDefaults.alloc.initWithSuiteName('com.apple.Terminal');
const profile = defaults.stringForKey('Default Window Settings').js;
const data = defaults.dictionaryForKey('Window Settings').objectForKey(profile).objectForKey('Font');
const font = $.NSKeyedUnarchiver.unarchiveObjectWithData(data);
JSON.stringify({ family: font.familyName.js, size: font.pointSize });
`;

// The terminal font is "terminalFont" from settings.json, else the font of Terminal.app's default profile.
function terminalFont() {
  const configured = settings.get('terminalFont');
  if (configured?.family) return Promise.resolve({ family: configured.family, size: Number(configured.size) || null });
  return new Promise((resolve) => {
    execFile('/usr/bin/osascript', ['-l', 'JavaScript', '-e', TERMINAL_APP_FONT], { timeout: 3000 }, (error, stdout) => {
      try {
        resolve(error ? null : JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
  });
}

const TERMINAL_COMMANDS = {
  herdr: () => (process.env.OFFICE_HERDR_CLIENT ? ['/bin/sh', ['-c', process.env.OFFICE_HERDR_CLIENT]] : [HERDR, []]),
  shell: () => [os.userInfo().shell || process.env.SHELL || '/bin/zsh', ['-l']],
};

// When the app is started from inside a Herdr pane, its markers would make the embedded
// Herdr client refuse to start ("nested herdr") and leak into the shell tabs.
function terminalEnv() {
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  if (!env.LANG) env.LANG = 'en_US.UTF-8'; // apps started from the Finder have no locale
  for (const key of Object.keys(env)) if (key.startsWith('HERDR_')) delete env[key];
  if (/herdr/i.test(env.TERM_PROGRAM || '')) {
    delete env.TERM_PROGRAM;
    delete env.TERM_PROGRAM_VERSION;
  }
  return env;
}

ipcMain.handle('pty:open', (_event, { kind, cols, rows }) => {
  const [command, args] = TERMINAL_COMMANDS[kind]();
  const id = `${kind}#${Date.now()}`;
  const terminal = pty.spawn(command, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: terminalEnv(),
  });
  terminal.onData((data) => send('pty:data', { id, data }));
  terminal.onExit(() => {
    terminals.delete(id);
    send('pty:exit', { id });
  });
  terminals.set(id, terminal);
  return id;
});

ipcMain.on('pty:input', (_event, { id, data }) => terminals.get(id)?.write(data));
ipcMain.on('pty:resize', (_event, { id, cols, rows }) => {
  try {
    terminals.get(id)?.resize(cols, rows);
  } catch {
    // the pty may have exited between the resize and this handler
  }
});
ipcMain.on('pty:close', (_event, { id }) => {
  const terminal = terminals.get(id);
  terminals.delete(id);
  terminal?.kill();
});
ipcMain.handle('agents:get', () => roster.snapshot());
ipcMain.handle('terminal:font', () => terminalFont());
ipcMain.handle('follow-focus:get', () => settings.get('followFocus'));
ipcMain.handle('animations:get', () => settings.get('animations'));
ipcMain.on('herdr:focus', (_event, { paneId }) => {
  execFile(HERDR, ['agent', 'focus', paneId], { timeout: 5000 }, (error) => {
    if (error) send('herdr-error', `herdr agent focus ${paneId}: ${error.message}`);
  });
});

app.whenReady().then(() => {
  i18n = I18n.create(uiLanguage());
  settings = loadSettings(path.join(app.getPath('userData'), 'settings.json'));
  roster = createRoster(path.join(app.getPath('userData'), 'roster.json'), settings.get('names'));
  speaker = createSpeaker(i18n.lang);
  installMenu();
  createWindow();
  startHookServer();
  herdrWatch = watchHerdr(() => scheduleRefresh(EVENT_DEBOUNCE_MS));
  scheduleRefresh(0);
});

app.on('window-all-closed', () => {
  for (const terminal of terminals.values()) terminal.kill();
  app.quit();
});
