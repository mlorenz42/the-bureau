// UI texts in German and English. The main process picks the language from the macOS settings
// (German if the preferred language is German, English otherwise) and hands it to the window.
(function (root) {
  const STRINGS = {
    de: {
      menuShell: 'Shell',
      newTab: 'Neuer Tab',
      closeTab: 'Tab schließen',
      nextTab: 'Nächster Tab',
      previousTab: 'Vorheriger Tab',
      menuView: 'Ansicht',
      paneShell: 'Konsole',
      defaultLayout: 'Standardansicht',
      followFocus: 'Zum aktiven Agenten laufen',
      animations: 'Animationen',
      menuAnnouncements: 'Ansagen',
      announceDone: '„… ist fertig“ ansagen',
      announceBlocked: '„… braucht dich“ ansagen',
      shortcutsMenu: 'Tastenkürzel …',
      shortcutsTitle: 'Tastenkürzel',
      shortcuts: [
        'Im Office',
        '  WASD / Pfeile – laufen',
        '  Klick – hingehen; auf einen freien Stuhl: hinsetzen',
        '  Klick auf Agent oder Herangehen – Agent in Herdr zeigen',
        '  Klick auf leeren Arbeitsplatz – Agent aus der Pause zurückholen',
        '  Enter – in Herdr tippen',
        '  H – zurück ins Chefbüro',
        '',
        'Terminals',
        '  ⌘Esc – Terminal verlassen, wieder laufen',
        '  ⌘T / ⌘W – Shell-Tab öffnen / schließen',
        '  ⌃Tab / ⌃⇧Tab – nächster / vorheriger Shell-Tab',
        '',
        'Ansicht',
        '  ⌘1 / ⌘2 / ⌘3 – Herdr / Konsole / Office ein- und ausblenden',
        '  ⌘0 – Standardansicht',
        '  Trennlinien ziehen – Größe ändern, Doppelklick – zurücksetzen',
      ],
      bubbleDone: 'Fertig!',
      bubbleBlocked: 'Hast du kurz?',
      hookPortError: 'Hook-Port {port}: {message}',
      me: 'Ich',
      roomOffice: 'Mein Büro',
      roomMeeting: 'Meeting',
      roomLounge: 'Lounge',
      legendTitle: 'LEGENDE',
      legend: { working: 'arbeitet', blocked: 'braucht dich', done: 'fertig', idle: 'idle · ☕' },
      helpRugs: {
        walk: ['LAUFEN', [[['WASD / Pfeile', 'laufen']], [['Klick', 'hingehen'], ['H', 'Chefbüro']]]],
        agents: ['AGENTEN', [[['Klick / Herangehen', 'in Herdr']], [['Enter', 'tippen'], ['⌘Esc', 'zurück']]]],
        terminals: ['TERMINALS', [[['⌘T / ⌘W', 'Tab auf / zu']], [['⌃Tab', 'nächster Tab']]]],
        view: ['ANSICHT', [[['⌘1 ⌘2 ⌘3', 'ein / aus']], [['⌘0', 'Standard'], ['⌘/', 'Hilfe']]]],
      },
      terminalExited: '[{label} beendet – Taste drücken zum Neustarten]',
      newTabHint: 'Neuer Tab (⌘T)',
      splitterHint: 'Ziehen zum Anpassen, Doppelklick = Standard',
      officeHint:
        'WASD/Pfeile: laufen · Klick: hingehen, auf freien Stuhl: hinsetzen · Klick auf Agent oder Herangehen: in Herdr zeigen · Enter: in Herdr tippen · ⌘Esc: zurück ins Büro · H: Chefbüro · Alle Kürzel: Hilfe-Menü',
    },
    en: {
      menuShell: 'Shell',
      newTab: 'New Tab',
      closeTab: 'Close Tab',
      nextTab: 'Next Tab',
      previousTab: 'Previous Tab',
      menuView: 'View',
      paneShell: 'Shell',
      defaultLayout: 'Default Layout',
      followFocus: 'Walk to the Active Agent',
      animations: 'Animations',
      menuAnnouncements: 'Announcements',
      announceDone: 'Announce “… is done”',
      announceBlocked: 'Announce “… needs you”',
      shortcutsMenu: 'Keyboard Shortcuts…',
      shortcutsTitle: 'Keyboard Shortcuts',
      shortcuts: [
        'In the office',
        '  WASD / arrows – walk',
        '  Click – walk there; on a free chair: sit down',
        '  Click an agent or walk up to it – show it in Herdr',
        '  Click an empty desk – call its agent back from the break',
        '  Enter – type into Herdr',
        '  H – back to your office',
        '',
        'Terminals',
        '  ⌘Esc – leave the terminal, walk again',
        '  ⌘T / ⌘W – open / close a shell tab',
        '  ⌃Tab / ⌃⇧Tab – next / previous shell tab',
        '',
        'View',
        '  ⌘1 / ⌘2 / ⌘3 – show / hide Herdr, shell, office',
        '  ⌘0 – default layout',
        '  Drag the dividers to resize, double-click to reset',
      ],
      bubbleDone: 'Done!',
      bubbleBlocked: 'Got a minute?',
      hookPortError: 'Hook port {port}: {message}',
      me: 'Me',
      roomOffice: 'My Office',
      roomMeeting: 'Meeting',
      roomLounge: 'Lounge',
      legendTitle: 'LEGEND',
      legend: { working: 'working', blocked: 'needs you', done: 'done', idle: 'idle · ☕' },
      helpRugs: {
        walk: ['WALK', [[['WASD / arrows', 'walk']], [['Click', 'go there'], ['H', 'my office']]]],
        agents: ['AGENTS', [[['Click / walk up', 'show in Herdr']], [['Enter', 'type'], ['⌘Esc', 'back']]]],
        terminals: ['TERMINALS', [[['⌘T / ⌘W', 'open / close tab']], [['⌃Tab', 'next tab']]]],
        view: ['VIEW', [[['⌘1 ⌘2 ⌘3', 'show / hide']], [['⌘0', 'default'], ['⌘/', 'help']]]],
      },
      terminalExited: '[{label} exited – press a key to restart]',
      newTabHint: 'New tab (⌘T)',
      splitterHint: 'Drag to resize, double-click to reset',
      officeHint:
        'WASD/arrows: walk · Click: walk there, on a free chair: sit down · Click an agent or walk up to it: show in Herdr · Enter: type into Herdr · ⌘Esc: back to the office · H: your office · All shortcuts: Help menu',
    },
  };

  function languageOf(locale) {
    return String(locale || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  function create(locale) {
    const lang = languageOf(locale);
    const table = STRINGS[lang];
    return {
      lang,
      t(key, vars = {}) {
        const text = table[key] ?? STRINGS.en[key] ?? key;
        return typeof text === 'string' ? text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '') : text;
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { create, languageOf };
  else root.I18n = create(root.office && root.office.lang);
})(this);
