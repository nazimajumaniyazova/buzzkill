import { ACHIEVEMENT_SCORE } from '@buzzkill/game';

import { NICKNAME_LENGTH } from '../backend/nickname';
import type { Dictionary, Messages } from './en';

/**
 * The Russian strings. The `Dictionary` type comes from the English file, so a missing or an
 * extra key, or a message with other parameters, fails to compile.
 */
export const ru: Dictionary = (format): Messages => ({
  common: {
    back: 'Назад',
    close: 'Закрыть',
    notifications: 'Уведомления',
  },
  actions: {
    moveUp: 'Вверх',
    moveDown: 'Вниз',
    fire: 'Стрелять',
    pause: 'Пауза',
  },
  keys: {
    ArrowUp: 'Стрелка вверх',
    ArrowDown: 'Стрелка вниз',
    ArrowLeft: 'Стрелка влево',
    ArrowRight: 'Стрелка вправо',
    Escape: 'Escape',
    Space: 'Пробел',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    ShiftLeft: 'Левый Shift',
    ShiftRight: 'Правый Shift',
    ControlLeft: 'Левый Ctrl',
    ControlRight: 'Правый Ctrl',
    AltLeft: 'Левый Alt',
    AltRight: 'Правый Alt',
  },
  loading: {
    progress: 'Загрузка',
    failed: 'Игра не загрузилась',
    codeFailed: 'Код игры не скачался. После перезагрузки страница получит последнюю версию.',
    reload: 'Перезагрузить страницу',
    failure: ({ file, reason }) => `${file}: ${reason}`,
    reasons: {
      network: 'сетевой запрос не удался',
      http: 'сервер вернул ошибку',
      decode: 'файл повреждён',
      unavailable: 'этот браузер не может его воспроизвести',
      unknown: 'непредвиденная ошибка',
    },
    retry: 'Попробовать снова',
  },
  menu: {
    title: 'Buzzkill',
    tagline: '3023 год. Гигантские насекомые из космоса атакуют город. Сбейте их.',
    navigation: 'Главное меню',
    play: 'Играть',
    daily: 'Ежедневный челлендж',
    dailyBest: (score) => `Лучший результат сегодня: ${format.number(score)}`,
    dailyNotPlayed: 'Сегодня ещё не сыграно',
    boards: 'Рекорды',
    settings: 'Настройки',
    help: 'Справка',
    achievements: 'Достижения',
  },
  achievements: {
    title: 'Достижения',
    intro: 'Хранятся на этом устройстве. Каждая игра приближает к ним.',
    progress: (count, goal) => `${format.number(count)} из ${format.number(goal)}`,
    earned: 'Получено',
    unlocked: 'Новое достижение',
    items: {
      firstSwat: { name: 'Первый удар', description: () => 'Уничтожьте насекомое.' },
      swatter: {
        name: 'Мухобойка',
        description: (goal) =>
          `Уничтожьте ${format.number(goal)} ${format.plural(goal, { one: 'насекомое', few: 'насекомых', many: 'насекомых', other: 'насекомого' })}.`,
      },
      nightShift: {
        name: 'Ночная смена',
        description: (goal) =>
          `Уничтожьте ${format.number(goal)} ${format.plural(goal, { one: 'насекомое', few: 'насекомых', many: 'насекомых', other: 'насекомого' })} ночью.`,
      },
      untouched: {
        name: 'Без единой царапины',
        description: () => 'Пройдите уровень, не потеряв ни одной жизни.',
      },
      collector: {
        name: 'Коллекционер',
        description: (goal) =>
          `Соберите ${format.number(goal)} ${format.plural(goal, { one: 'бонус', few: 'бонуса', many: 'бонусов', other: 'бонуса' })}.`,
      },
      regicide: { name: 'Цареубийца', description: () => 'Победите королеву.' },
      champion: { name: 'Чемпион', description: () => 'Пройдите всю кампанию.' },
      flawless: {
        name: 'Безупречно',
        description: () => 'Пройдите всю кампанию, не потеряв ни одной жизни.',
      },
      highScore: {
        name: 'Рекордсмен',
        description: () => `Наберите ${format.number(ACHIEVEMENT_SCORE)} очков за одну игру.`,
      },
    },
  },
  heroSelect: {
    title: 'Выберите героя',
    hero: 'Герой',
    heroes: { male: 'Майк', female: 'Джули', sam: 'Сэм', leo: 'Лео' },
    locked: (achievement, description) =>
      `Закрыт: получите достижение «${achievement}». ${description}`,
    timeOfDay: 'Время суток',
    modes: { day: 'День', night: 'Ночь' },
    start: 'Начать',
    dailyTitle: 'Ежедневный челлендж',
    dailyAbout: (date) =>
      `${format.date(date)}: сегодня у всех одна и та же игра, днём, на обычной сложности.`,
  },
  settings: {
    title: 'Настройки',
    sections: 'Разделы настроек',
    tabs: {
      sound: 'Звук',
      display: 'Экран',
      gameplay: 'Игра',
      effects: 'Эффекты',
      controls: 'Управление',
    },
    sound: 'Звук',
    effectsVolume: 'Громкость эффектов',
    musicVolume: 'Громкость музыки',
    theme: 'Тема',
    themes: {
      system: 'Как в системе',
      day: 'Всегда день',
      night: 'Всегда ночь',
    },
    motion: 'Движение',
    motions: {
      system: 'Как в системе',
      reduced: 'Уменьшенное',
      full: 'Полное',
    },
    language: 'Язык',
    difficulty: 'Сложность',
    difficulties: {
      easy: 'Лёгкая',
      normal: 'Обычная',
      hard: 'Сложная',
    },
    gameSpeed: 'Скорость игры',
    gameSpeedHint: `На меньшей скорости больше времени на реакцию. В таблицу рекордов попадают только игры на ${format.percent(1)}.`,
    particles: 'Частицы',
    particlesHint:
      'Искры от попаданий, обломки и пыль от сбитых насекомых, следы за выстрелами. При уменьшенном движении их меньше и они короче.',
    screenShake: 'Тряска экрана',
    screenShakeHint:
      'Экран трясётся, когда героя ранят, когда взрываются насекомые и когда королева прилетает, приходит в ярость и падает. При уменьшенном движении тряски нет.',
    hitFlash: 'Вспышка при попадании',
    hitFlashHint:
      'Насекомое, королева или герой вспыхивают белым при попадании: при уменьшенном движении мягче, и не чаще трёх раз в секунду.',
    squashStretch: 'Сжатие и растяжение',
    squashStretchHint:
      'Герой слегка сжимается при выстреле, а насекомые вытягиваются, покачиваясь в полёте. При уменьшенном движении этого нет.',
    hitStop: 'Стоп-кадр при ударе',
    hitStopHint:
      'Картинка на миг замирает, когда героя ранят, когда королева приходит в ярость и когда она падает; сама игра при этом идёт. При уменьшенном движении этого нет.',
    vibration: 'Вибрация',
    vibrationHint: 'Телефон и геймпад коротко вибрируют, когда героя ранят.',
  },
  keyEditor: {
    caption: 'Клавиатура',
    action: 'Действие',
    slot: (slot) => `Клавиша ${format.number(slot)}`,
    button: ({ action, slot, key }) => `${action}, клавиша ${format.number(slot)}: ${key}`,
    waiting: 'Нажмите клавишу…',
    waitingName: 'ожидание клавиши',
    prompt: (action) => `Нажмите клавишу для действия «${action}» или Escape для отмены.`,
    cancelled: 'Без изменений.',
    bound: ({ action, key }) => `Действие «${action}» теперь на клавише ${key}.`,
    displaced: ({ key, action, newKey }) =>
      `Клавиша ${key} была у действия «${action}», теперь у него клавиша ${newKey}.`,
    reset: 'Сбросить клавиши',
    resetDone: 'Клавиши по умолчанию восстановлены.',
  },
  help: {
    title: 'Справка',
    intro: (lives) =>
      `Сбивайте насекомых, пока они не долетели до города. ${format.number(lives)} ${format.plural(lives, { one: 'попадание', few: 'попадания', many: 'попаданий', other: 'попадания' })} — и игра окончена.`,
    powerUps:
      'Сбитые насекомые иногда роняют бонусы. Коснитесь бонуса, чтобы подобрать его: патроны, жизнь, щит или скорострельность на несколько секунд.',
    boss: 'Третий и шестой уровни заканчиваются королевой ос. Уворачивайтесь от её жал и стреляйте, пока она парит. Когда её полоса краснеет, она идёт на таран: сначала красные линии отмечают её путь, уйдите с него.',
    keyboard: 'Клавиатура',
    gamepad: 'Геймпад',
    touch: 'Сенсорный экран',
    touchControls: {
      moveUp: 'Сдвиньте стик слева внизу вверх',
      moveDown: 'Сдвиньте стик слева внизу вниз',
      fire: 'Удерживайте кнопку справа внизу',
      pause: 'Нажмите кнопку справа вверху',
    },
    menus: 'В меню',
    or: 'или',
    move: 'Перейти',
    select: 'Выбрать',
    goBack: 'Назад или закрыть окно',
    arrowKeys: 'Стрелки',
    dpad: 'Крестовина',
    leftStick: 'Левый стик',
    padButtons: {
      a: 'A',
      b: 'B',
      start: 'Start',
      dpadUp: 'Крестовина вверх',
      dpadDown: 'Крестовина вниз',
      dpadLeft: 'Крестовина влево',
      dpadRight: 'Крестовина вправо',
    },
    padButton: (button) => `Кнопка ${format.number(button)}`,
  },
  game: {
    label: 'Игра',
    canvas: 'Игровое поле Buzzkill',
    unsupported: 'Ваш браузер не поддерживает элемент canvas, поэтому игра не запустится.',
    turnSideways: 'Поверните телефон боком — картинка станет больше.',
  },
  hud: {
    label: 'Состояние игры',
    score: 'Счёт',
    lives: 'Жизни',
    ammo: 'Патроны',
    level: 'Уровень',
    livesValue: (lives, max) => `${format.number(lives)} из ${format.number(max)}`,
    levelValue: (level, last) => `${format.number(level)} из ${format.number(last)}`,
    shield: 'Щит',
    rapidFire: 'Скорострельность',
    secondsLeft: (seconds) => `${format.number(seconds)} с`,
    boss: 'Королева ос',
    bossHealth: (health, max) => `${format.number(health)} из ${format.number(max)}`,
  },
  pause: {
    title: 'Пауза',
    description: 'Игра ждёт вас.',
    gamepadLost: 'Геймпад отключился. Подключите его снова и продолжите или играйте с клавиатуры.',
    resume: 'Продолжить',
    quit: 'Выйти в меню',
  },
  levelCleared: {
    title: (level) => `Уровень ${format.number(level)} пройден`,
    description: (score, change) =>
      `Счёт: ${format.number(score)}.${
        {
          none: '',
          nightFalls: ' Над городом опускается ночь.',
          dayBreaks: ' Над городом встаёт солнце.',
        }[change]
      }`,
    next: 'Следующий уровень',
    quit: 'Выйти в меню',
  },
  runOver: {
    titles: { victory: 'Победа', gameOver: 'Игра окончена' },
    score: (score) => `Счёт: ${format.number(score)}`,
    playAgain: 'Играть снова',
    watch: 'Посмотреть повтор',
    quit: 'В меню',
  },
  replay: {
    label: 'Повтор',
    controls: 'Управление повтором',
    pause: 'Пауза',
    play: 'Смотреть',
    rewind: 'Смотреть с начала',
    speed: 'Скорость',
    speedOption: (speed) => `${format.number(speed)}×`,
    over: 'Повтор закончился.',
  },
  boards: {
    title: 'Рекорды',
    intro: `Лучшая игра каждого игрока на скорости ${format.percent(1)}. Игра на меньшей скорости остаётся только вашим личным рекордом.`,
    tabs: 'Таблица',
    today: 'Сегодня',
    caption: (size, difficulty) => `Топ-${format.number(size)}: ${difficulty}`,
    dailyCaption: (size, date) => `Топ-${format.number(size)} за ${format.date(date)}`,
    columns: { place: 'Место', player: 'Игрок', score: 'Счёт', level: 'Уровень' },
    noNickname: 'Игрок без ника',
    you: (name) => `${name} (вы)`,
    loading: 'Загружаем таблицу…',
    offline: 'Таблицу сейчас не загрузить. Ваши игры сохранены и отправятся, когда появится сеть.',
    retry: 'Повторить',
    empty: 'В этой таблице пока нет игр.',
    personalBest: (score, level) =>
      `Ваш рекорд: ${format.number(score)}, уровень ${format.number(level)}.`,
    slower: (speed) => `Сыгран на скорости ${format.percent(speed)}, поэтому виден только вам.`,
    noRecord: 'Ваша лучшая игра в этой таблице появится здесь, когда она будет сохранена.',
  },
  uploads: {
    kept: 'Игра сохранена на этом устройстве',
    keptDetail: 'Она попадёт в таблицы, когда появится связь с сервером.',
    sent: (count) => {
      const n = format.number(count);
      return format.plural(count, {
        one: `Отправлена ${n} игра, ждавшая сети.`,
        few: `Отправлены ${n} игры, ждавшие сети.`,
        many: `Отправлено ${n} игр, ждавших сети.`,
        other: `Отправлено ${n} игры, ждавших сети.`,
      });
    },
    refused: (count) => {
      const n = format.number(count);
      return format.plural(count, {
        one: `Сервер не подтвердил ${n} игру, поэтому её нет в таблицах.`,
        few: `Сервер не подтвердил ${n} игры, поэтому их нет в таблицах.`,
        many: `Сервер не подтвердил ${n} игр, поэтому их нет в таблицах.`,
        other: `Сервер не подтвердил ${n} игры, поэтому их нет в таблицах.`,
      });
    },
  },
  nickname: {
    title: 'Ваш ник',
    description: 'Другие игроки видят его рядом с вашими результатами.',
    label: 'Ник',
    rules: `От ${format.number(NICKNAME_LENGTH.min)} до ${format.number(NICKNAME_LENGTH.max)} букв, цифр, точек, дефисов или подчёркиваний, между словами по одному пробелу.`,
    problems: {
      'too-short': `В нике не меньше ${format.number(NICKNAME_LENGTH.min)} ${format.plural(NICKNAME_LENGTH.min, { one: 'символа', few: 'символов', many: 'символов', other: 'символа' })}.`,
      'too-long': `В нике не больше ${format.number(NICKNAME_LENGTH.max)} ${format.plural(NICKNAME_LENGTH.max, { one: 'символа', few: 'символов', many: 'символов', other: 'символа' })}.`,
      characters:
        'Используйте только буквы, цифры, точки, дефисы и подчёркивания, между словами по одному пробелу.',
    },
    save: 'Сохранить',
    saving: 'Сохранение…',
    cancel: 'Отмена',
    failures: {
      offline: 'Нет связи, ник не сохранён. Попробуйте позже.',
      unavailable: 'Сервер не сохранил ник. Попробуйте позже.',
    },
  },
  announce: {
    levelStart: (level) => `Уровень ${format.number(level)}. Вперёд!`,
    lifeLost: (lives) => {
      const left = format.number(lives);
      return `Попадание! ${format.plural(lives, {
        one: `Осталась ${left} жизнь`,
        few: `Осталось ${left} жизни`,
        many: `Осталось ${left} жизней`,
        other: `Осталось ${left} жизни`,
      })}.`;
    },
    levelCleared: (level, score) =>
      `Уровень ${format.number(level)} пройден. Счёт: ${format.number(score)}.`,
    lifeGained: (lives) =>
      `Дополнительная жизнь! Теперь ${format.number(lives)} ${format.plural(lives, {
        one: 'жизнь',
        few: 'жизни',
        many: 'жизней',
        other: 'жизни',
      })}.`,
    shieldOn: (seconds) =>
      `Щит на ${format.number(seconds)} ${format.plural(seconds, { one: 'секунду', few: 'секунды', many: 'секунд', other: 'секунды' })}.`,
    rapidFireOn: (seconds) =>
      `Скорострельность на ${format.number(seconds)} ${format.plural(seconds, { one: 'секунду', few: 'секунды', many: 'секунд', other: 'секунды' })}.`,
    bossArrived: 'Королева ос! Уворачивайтесь от жал.',
    bossEnraged: 'Королева в ярости! Берегитесь тарана.',
    bossDefeated: (score) => `Королева повержена! Плюс ${format.number(score)}.`,
    victory: (score) => `Победа! Все уровни пройдены. Счёт: ${format.number(score)}.`,
    gameOver: (score) => `Игра окончена. Счёт: ${format.number(score)}.`,
  },
  error: {
    title: 'Что-то пошло не так',
    areas: {
      shell:
        'Buzzkill остановился из-за непредвиденной ошибки. «Начать заново» снова откроет меню, настройки сохранены.',
      game: 'Игра прервалась из-за непредвиденной ошибки. «Начать заново» вернёт вас в меню, настройки сохранены.',
    },
    restart: 'Начать заново',
  },
});
