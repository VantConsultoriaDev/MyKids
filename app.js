const toast = document.querySelector('.toast');
const appView = document.querySelector('#app-view');
const overviewMarkup = appView.innerHTML;
let toastTimer;
let authenticated = false;
let familyData = { family: null, children: [], responsibleName: '' };
let activities = [];
let activitiesError = '';
let exams = [];
let studySubjects = [];
let studySubjectsLoaded = false;
let selectedScheduleDate = new Date();
let overviewChildId = '';
let currentChildSession = null;

function scheduleDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function scheduleDateFromKey(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function scheduleDateLabel(date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(date);
}

function scheduleDayNavigator() {
  const selectedKey = scheduleDateKey(selectedScheduleDate);
  const days = [-2, -1, 0, 1, 2].map((offset) => {
    const date = new Date(selectedScheduleDate);
    date.setDate(date.getDate() + offset);
    const key = scheduleDateKey(date);
    const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
    return `<button class="schedule-day-chip${key === selectedKey ? ' selected' : ''}" type="button" data-schedule-date="${key}"><span>${escapeHtml(label)}</span><strong>${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}</strong></button>`;
  }).join('');
  return `<div class="schedule-day-nav" aria-label="Selecionar dia"><button class="schedule-day-arrow" type="button" data-schedule-shift="-1" aria-label="Dia anterior">‹</button>${days}<button class="schedule-day-arrow" type="button" data-schedule-shift="1" aria-label="Próximo dia">›</button><button class="schedule-today-button" type="button" data-schedule-today>Hoje</button></div>`;
}

function bindScheduleNavigation(onChange) {
  document.querySelectorAll('[data-schedule-date]').forEach((button) => button.addEventListener('click', () => { selectedScheduleDate = scheduleDateFromKey(button.dataset.scheduleDate); onChange(); }));
  document.querySelectorAll('[data-schedule-shift]').forEach((button) => button.addEventListener('click', () => { selectedScheduleDate.setDate(selectedScheduleDate.getDate() + Number(button.dataset.scheduleShift)); onChange(); }));
  document.querySelectorAll('[data-schedule-today]').forEach((button) => button.addEventListener('click', () => { selectedScheduleDate = new Date(); onChange(); }));
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  const toggle = document.querySelector('#themeToggle');
  if (!toggle) return;
  toggle.textContent = isDark ? '☀' : '☾';
  toggle.setAttribute('aria-pressed', String(isDark));
  toggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
}

function bindThemeToggle() {
  const toggle = document.querySelector('#themeToggle');
  if (!toggle || toggle.dataset.bound) return;
  toggle.dataset.bound = 'true';
  applyTheme(localStorage.getItem('mykids-theme') === 'dark');
  toggle.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark-mode');
    localStorage.setItem('mykids-theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
  });
}

const pageMeta = {
  inicio: ['Visão geral', 'Acompanhe o ritmo da família e ajude cada conquista a virar hábito.'],
  estudos: ['Estudos', 'Acompanhe sessões, matérias e a evolução do aprendizado.'],
  responsabilidades: ['Responsabilidades', 'Distribua tarefas e reconheça cada conquista.'],
  relatorios: ['Relatórios', 'Uma leitura semanal do ritmo e da evolução da família.'],
  tempo: ['Tracker de tempo', 'Registre estudo, lazer e descanso em um só lugar.'],
  crianca: ['Início', 'A experiência infantil para executar atividades e acompanhar conquistas.'],
  perfil: ['Perfil', 'Acompanhe o avatar, XP, pontos e conquistas da criança.'],
  loja: ['Loja', 'Personalize o avatar e continue a jornada infantil com itens e conquistas.'],
  login: ['Entrar', 'Acesse sua conta MyKids.'],
  'child-login': ['Acesso infantil', 'Entre com o e-mail e senha cadastrados pelo responsável.'],
  onboarding: ['Começar com o MyKids', 'Configure a rotina da sua família em poucos passos.'],
  configuracoes: ['Configurações', 'Ajuste a experiência da família ao seu jeito.']
};

function resolveErrorMessage(error, fallback = 'Ocorreu um erro inesperado.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error.trim() || fallback;
  if (error instanceof Error && error.message) return error.message.trim() || fallback;

  const candidates = [
    error?.message,
    error?.details,
    error?.error,
    error?.title,
    error?.context?.error,
    error?.context?.message,
    error?.context?.details,
    error?.response?.error,
    error?.response?.message,
    error?.body,
    error?.data?.error
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') return serialized;
  } catch (jsonError) {
    console.warn('Não foi possível serializar o erro para exibição.', jsonError);
  }

  return fallback;
}

function showToast(message) {
  const resolvedMessage = resolveErrorMessage(message, 'Ocorreu um erro inesperado.');
  toast.textContent = resolvedMessage;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
}

function renderCurrentDate() {
  const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
  document.querySelectorAll('.current-date').forEach((element) => { element.textContent = date.toUpperCase(); });
}

async function loadFamilyData() {
  try {
    familyData = await window.MyKidsData.getFamilyDashboard();
    zeroFamilyProgression();
  } catch (error) {
    console.error('Não foi possível carregar os dados da família.', error);
    familyData = { family: null, children: [], responsibleName: '' };
    clearAllProgressionStorage();
  }
}

async function loadActivities() {
  if (!familyData.family?.id) { activities = []; return; }
  try {
    activitiesError = '';
    activities = await window.MyKidsData.listActivities(familyData.family.id);
  } catch (error) {
    activities = [];
    activitiesError = error.message || 'Não foi possível carregar as atividades.';
    console.error('Não foi possível carregar as atividades.', error);
  }
}

async function loadExams() {
  if (!familyData.family?.id) { exams = []; return; }
  try { exams = await window.MyKidsData.listExams(familyData.family.id); } catch (error) { exams = []; console.error('Não foi possível carregar as provas.', error); }
}

async function loadStudySubjects() {
  if (!familyData.family?.id) { studySubjects = []; studySubjectsLoaded = true; return; }
  try {
    const data = await window.MyKidsData.listStudySubjects(familyData.family.id);
    studySubjects = data.map((subject) => ({ id: subject.id, childId: subject.child_id, name: subject.name, description: subject.description || '', topics: subject.topics || [] }));
    studySubjectsLoaded = true;
    localStorage.setItem(studyStorageKey(), JSON.stringify(studySubjects));
  } catch (error) {
    studySubjectsLoaded = false;
    console.error('Não foi possível carregar as matérias.', error);
    try { studySubjects = JSON.parse(localStorage.getItem(studyStorageKey()) || '[]'); } catch { studySubjects = []; }
  }
}

function renderOverviewActivities() {
  const timeline = document.querySelector('.routine-panel .timeline');
  if (!timeline) return;
  const selectedDateKey = scheduleDateKey(selectedScheduleDate);
  const routineHeading = document.querySelector('.routine-panel .panel-heading h2');
  if (routineHeading) routineHeading.textContent = `Rotina de ${scheduleDateLabel(selectedScheduleDate).split(',')[0]}`;
  const dayNavigator = document.querySelector('.routine-panel .schedule-day-nav');
  if (dayNavigator) dayNavigator.outerHTML = scheduleDayNavigator();
  else timeline.insertAdjacentHTML('beforebegin', scheduleDayNavigator());
  const selectedActivities = activities.filter((activity) => activity.child_id === overviewChildId && activityIsScheduled(activity, selectedScheduleDate));
  if (!selectedActivities.length) {
    timeline.innerHTML = '<div class="empty-panel-message"><strong>Nenhuma atividade programada</strong><span>Estudos e responsabilidades cadastrados aparecerão aqui.</span></div>';
    return;
  }
  timeline.innerHTML = selectedActivities.map((activity) => { const completed = activity.occurrences?.some((occurrence) => occurrence.occurrence_date === selectedDateKey && occurrence.status === 'completed'); return `<div class="timeline-item${completed ? ' is-complete' : ''}"><time>${formatActivityTime(activity.start_time)}</time><button class="activity-checkbox${completed ? ' checked' : ''}" type="button" data-activity-action="toggle" data-activity-id="${escapeHtml(activity.id)}" data-child-id="${escapeHtml(activity.child_id)}" aria-label="${completed ? 'Desmarcar' : 'Marcar'} ${escapeHtml(activity.name)}" aria-pressed="${completed}">${completed ? '✓' : ''}</button><div><strong>${escapeHtml(activity.name)}</strong><span>${activity.kind === 'study' ? `${escapeHtml(activity.subject || 'Estudo')}${activity.subtopic ? ` · ${escapeHtml(activity.subtopic)}` : ''}` : ''}${activity.duration_minutes ? ` · ${activity.duration_minutes} min` : ''}</span></div><b>${activityRecurrenceLabel(activity.recurrence)}</b></div>`; }).join('');
}

function renderOverviewProgress() {
  const childId = overviewChildId || familyData.children?.[0]?.id;
  if (!childId) return;
  const progress = childProgress(childId);
  const selectedDateKey = scheduleDateKey(selectedScheduleDate);
  const selectedActivities = activities.filter((activity) => activity.child_id === childId && activityIsScheduled(activity, selectedScheduleDate));
  const responsibilities = selectedActivities;
  const completedResponsibilities = responsibilities.filter((activity) => activity.occurrences?.some((occurrence) => occurrence.occurrence_date === selectedDateKey && occurrence.status === 'completed')).length;
  const responsibilityPercentage = responsibilities.length ? Math.round((completedResponsibilities / responsibilities.length) * 100) : 0;
  const metrics = document.querySelectorAll('.metric-card');
  if (metrics.length >= 4) {
    metrics[1].querySelector('span').textContent = 'Atividades do dia';
    metrics[1].querySelector('strong').innerHTML = `${completedResponsibilities} <small>/ ${responsibilities.length}</small>`;
    metrics[1].querySelector('em').textContent = responsibilities.length ? `${responsibilityPercentage}% concluídas em ${scheduleDateLabel(selectedScheduleDate)}` : 'Nenhuma atividade criada';
    const responsibilityRing = metrics[1].querySelector('.progress-ring');
    if (responsibilityRing) {
      responsibilityRing.textContent = `${responsibilityPercentage}%`;
      responsibilityRing.style.background = `conic-gradient(var(--blue) ${responsibilityPercentage}%, #dfebf5 0)`;
    }
    metrics[2].querySelector('strong').innerHTML = `${progress.points} <small>pts</small>`;
    metrics[2].querySelector('em').textContent = `${progress.totalXp} XP acumulados`;
  }
  let panel = document.querySelector('.overview-xp-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'overview-xp-panel';
    document.querySelector('.metric-grid')?.after(panel);
  }
  panel.innerHTML = progressPanel(childId);
}

function renderFamilyData() {
  const familyName = familyData.family?.name || 'Minha família';
  const responsibleName = familyData.responsibleName || 'Responsável';
  const familyNameElement = document.querySelector('.family-switcher strong');
  const familyAvatar = document.querySelector('.family-avatar');
  const greeting = document.querySelector('.welcome-row h1');
  if (familyNameElement) familyNameElement.textContent = familyName.replace(/^Família\s+/i, '');
  if (familyAvatar) familyAvatar.textContent = familyName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  if (greeting) greeting.innerHTML = `Bom dia, ${responsibleName} <span>👋</span>`;
  const profileName = document.querySelector('.profile-mini strong');
  if (profileName) profileName.textContent = responsibleName;
  const parentAvatar = document.querySelector('.avatar-parent');
  if (parentAvatar) parentAvatar.textContent = responsibleName[0]?.toUpperCase() || '?';
  const breadcrumbFamily = document.querySelector('.breadcrumb span');
  if (breadcrumbFamily) breadcrumbFamily.textContent = familyName;
  const tabs = document.querySelector('.child-tabs');
  if (tabs) {
    if (!familyData.children.some((child) => child.id === overviewChildId)) overviewChildId = familyData.children?.[0]?.id || '';
    tabs.innerHTML = '';
    (familyData.children || []).forEach((child, index) => {
      const tab = document.createElement('button');
      const isSelected = child.id === overviewChildId;
      tab.className = `child-tab${isSelected ? ' active' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.type = 'button';
      tab.addEventListener('click', () => {
        overviewChildId = child.id;
        tabs.querySelectorAll('.child-tab').forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); });
        renderOverviewActivities();
        renderOverviewProgress();
        bindOverviewActivities();
        bindScheduleNavigation(refreshOverviewSchedule);
      });
      tab.innerHTML = `<span class="avatar">${(child.avatar || child.name?.[0] || '?').slice(0, 1).toUpperCase()}</span><span></span>`;
      const label = tab.querySelector('span:last-child');
      label.append(child.name || 'Sem nome');
      const age = document.createElement('small');
      age.textContent = child.age ? `${child.age} anos` : 'Idade não informada';
      label.appendChild(age);
      tabs.appendChild(tab);
    });
    if (!familyData.children?.length) tabs.innerHTML = '<div class="empty-panel-message"><strong>Nenhuma criança cadastrada</strong><span>Adicione uma criança para acompanhar a rotina.</span></div>';
  }
}

function emptyPage(title, description) {
  return `<div class="page-intro"><div><p class="eyebrow">${title.toUpperCase()}</p><h1>${title}</h1><p class="subtitle">${description || 'Os dados aparecerão aqui depois que sua família começar a usar o MyKids.'}</p></div></div><section class="panel"><div class="empty-panel-message"><strong>Nenhum dado cadastrado</strong><span>Comece adicionando informações para esta área.</span></div></section>`;
}

let childExamSession = null;
let childExamTimer = null;

function formatExamTime(totalSeconds) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function childExamList(childId) {
  const childExams = exams.filter((exam) => exam.child_id === childId);
  if (!childExams.length) return '<div class="empty-panel-message"><strong>Nenhuma prova disponível</strong><span>As provas criadas pelo responsável aparecerão aqui.</span></div>';
  return childExams.map((exam) => `<article class="managed-card exam-card"><div class="managed-card-icon">★</div><div class="managed-card-content"><h3>${escapeHtml(exam.name)}</h3><p>${exam.question_count} questões · ${exam.subjects.length} matéria(s)</p><div class="managed-card-meta"><span>${escapeHtml(exam.scheduled_date)}</span><span>${exam.duration_minutes} min</span><span>${exam.points_total || 0} pontos</span></div></div><div class="managed-card-actions"><button class="primary-button child-exam-start" type="button" data-exam-id="${escapeHtml(exam.id)}">Iniciar prova</button></div></article>`).join('');
}

function childExamRunner() {
  const session = childExamSession;
  const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  const remaining = Math.max(0, (Number(session.exam.duration_minutes) * 60) - elapsed);
  const questions = session.exam.questions || [];
  return `<div class="page-intro"><div><p class="eyebrow">PROVA EM ANDAMENTO</p><h1>${escapeHtml(session.exam.name)}</h1><p class="subtitle">Responda o que conseguir antes do tempo acabar.</p></div><div class="exam-countdown${remaining <= 60 ? ' is-warning' : ''}" id="exam-countdown" role="timer" aria-live="polite">${formatExamTime(remaining)}</div></div><form class="exam-runner" data-child-exam-form><div class="exam-question-list">${questions.map((question, index) => `<fieldset class="exam-question"><legend><strong>${index + 1}.</strong> ${escapeHtml(question.prompt)}</legend>${question.question_type === 'multiple_choice' ? `<div class="quiz-options">${(question.options || []).map((option) => `<label><input type="radio" name="question-${escapeHtml(question.id)}" value="${escapeHtml(option)}"${session.answers[question.id] === option ? ' checked' : ''}><span>${escapeHtml(option)}</span></label>`).join('')}</div>` : `<textarea name="question-${escapeHtml(question.id)}" rows="4" placeholder="Escreva sua resposta">${escapeHtml(session.answers[question.id] || '')}</textarea>`}</fieldset>`).join('')}</div><div class="exam-runner-actions"><span>O envio será automático quando o tempo terminar.</span><button class="primary-button" type="submit">Finalizar prova</button></div></form>`;
}

function getCurrentChildProfile() {
  if (currentChildSession) {
    return familyData.children?.find((entry) => entry.id === currentChildSession.childId) || {
      id: currentChildSession.childId,
      name: currentChildSession.childName || 'Criança',
      age: currentChildSession.age || null,
      avatar: currentChildSession.avatar || ''
    };
  }
  return familyData.children?.[0] || null;
}

const CHILD_STORE_CATALOG = [
  { id: 'rocket', emoji: '🚀', name: 'Foguete', cost: 0, rarity: 'inicial' },
  { id: 'fox', emoji: '🦊', name: 'Raposa', cost: 40, rarity: 'comum' },
  { id: 'bear', emoji: '🐼', name: 'Urso', cost: 60, rarity: 'comum' },
  { id: 'frog', emoji: '🐸', name: 'Sapo', cost: 80, rarity: 'comum' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicórnio', cost: 120, rarity: 'raro' },
  { id: 'robot', emoji: '🤖', name: 'Robô', cost: 180, rarity: 'raro' },
  { id: 'star', emoji: '🌟', name: 'Estrela', cost: 220, rarity: 'épico' },
  { id: 'console', emoji: '🎮', name: 'Console', cost: 260, rarity: 'épico' },
  { id: 'dragon', emoji: '🐉', name: 'Dragão', cost: 330, rarity: 'lendário' },
  { id: 'crown', emoji: '👑', name: 'Coroa', cost: 420, rarity: 'lendário' }
];

function getChildInventory(childId) {
  const familyKey = familyData.family?.id || 'local';
  const stored = localStorage.getItem(`mykids-child-store-${familyKey}-${childId}`);
  if (!stored) {
    return { selected: '🚀', owned: ['rocket'] };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      selected: parsed.selected || '🚀',
      owned: Array.isArray(parsed.owned) && parsed.owned.length ? parsed.owned : ['rocket']
    };
  } catch {
    return { selected: '🚀', owned: ['rocket'] };
  }
}

function writeChildInventory(childId, inventory) {
  const familyKey = familyData.family?.id || 'local';
  localStorage.setItem(`mykids-child-store-${familyKey}-${childId}`, JSON.stringify({
    selected: inventory.selected || '🚀',
    owned: Array.isArray(inventory.owned) ? inventory.owned : ['rocket']
  }));
}

function getChildProfileAvatar(child, fallback = '★') {
  const childId = child?.id || 'local';
  const storeInventory = getChildInventory(childId);
  if (storeInventory.selected) return storeInventory.selected;
  const stored = localStorage.getItem(`mykids-child-avatar-${childId}`);
  if (stored) return stored;
  if (child?.avatar) return child.avatar;
  return fallback;
}

function getChildGreeting(childName) {
  const lastLetter = String(childName || '').trim().slice(-1).toLowerCase();
  return lastLetter === 'a' ? 'Bem Vinda' : 'Bem Vindo';
}

function childPage() {
  const child = getCurrentChildProfile();
  if (!child) return emptyPage('Ambiente infantil', 'Cadastre uma criança para liberar este ambiente.');
  if (childExamSession) return childExamRunner();

  const progression = readProgression(child.id);
  const levelData = getLevelProgress(progression.totalXp || 0);
  const childActivities = activities.filter((activity) => activity.child_id === child.id);
  const todayKey = scheduleDateKey(new Date());
  const pendingToday = childActivities.filter((activity) => activityIsScheduled(activity, new Date()) && !activity.occurrences?.some((occurrence) => occurrence.occurrence_date === todayKey && occurrence.status === 'completed')).length;
  const completedToday = childActivities.filter((activity) => activity.occurrences?.some((occurrence) => occurrence.occurrence_date === todayKey && occurrence.status === 'completed')).length;
  const totalToday = Math.max(1, childActivities.filter((activity) => activityIsScheduled(activity, new Date())).length || 1);
  const completionRate = Math.min(100, Math.round((completedToday / totalToday) * 100));
  const nextExam = exams.filter((exam) => exam.child_id === child.id).slice(0, 2);
  const dailyActivities = childActivities.slice(0, 3);
  const avatar = getChildProfileAvatar(child, '★');
  const greeting = getChildGreeting(child.name);

  const today = new Date();
  const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(today).split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('-');
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(today);
  const pendingPercent = totalToday ? Math.round((pendingToday / totalToday) * 100) : 0;
  const completedPercent = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;

  return `
    <div class="child-app child-game-shell">
      <header class="child-header">
        <div class="child-greeting">
          <span class="status-chip">ONLINE</span>
          <strong>${greeting}, ${escapeHtml(child.name)}!</strong>
        </div>
        <div class="child-header-actions">
          <button class="text-button child-logout" type="button" data-child-action="logout">Sair</button>
        </div>
      </header>

      <section class="child-hero child-launcher">
        <div class="child-launcher-copy">
          <p class="eyebrow child-level-eyebrow">LEVEL ${levelData.level}</p>
          <h1>você está na sua jornada por muitas conquistas</h1>
          <p class="subtitle">Cada tarefa concluída transforma esforço em coragem, aprendizado e vitória.</p>
          <p class="subtitle motivational-line">Hoje é dia de avançar, crescer e escrever uma nova história.</p>
        </div>
        <div class="child-hero-art" aria-label="Avatar da criança">${escapeHtml(avatar)}</div>
      </section>

      <nav class="game-bar" aria-label="Menu infantil">
        <button class="game-bar-item active" type="button" data-page="crianca">
          <span>🏠</span>
          <small>Início</small>
        </button>
        <button class="game-bar-item" type="button" data-page="perfil">
          <span>🧭</span>
          <small>Perfil</small>
        </button>
        <button class="game-bar-item" type="button" data-page="loja">
          <span>🛍️</span>
          <small>Loja</small>
        </button>
      </nav>

      <section class="child-summary-grid">
        <div class="child-summary-card">
          <span>Hoje</span>
          <strong>${weekdayLabel}, ${dateLabel}</strong>
        </div>
        <div class="child-summary-card">
          <span>Pendentes</span>
          <strong>${pendingToday} (${pendingPercent}%)</strong>
          <small>tarefas em andamento</small>
        </div>
        <div class="child-summary-card">
          <span>Concluídos</span>
          <strong>${completedToday} (${completedPercent}%)</strong>
          <small>feito hoje</small>
        </div>
        <div class="child-summary-card">
          <span>Percentual</span>
          <strong>${completionRate}%</strong>
          <small>do dia</small>
        </div>
      </section>

      <section class="child-stats">
        <div class="stat-card stat-card-xp">
          <span>XP</span>
          <strong>${progression.totalXp || 0}</strong>
          <small>${levelData.currentXp}/${levelData.requiredXp}</small>
        </div>
        <div class="stat-card stat-card-streak">
          <span>Level</span>
          <strong>${levelData.level}</strong>
          <small>fases avançadas</small>
        </div>
        <div class="stat-card stat-card-exams">
          <span>Pontos</span>
          <strong>${Number(progression.points || 0)}</strong>
          <small>acumulados</small>
        </div>
      </section>

      <section class="child-content-grid">
        <div class="panel child-panel mission-panel">
          <div class="panel-heading">
            <div><p class="eyebrow">MISSÕES</p><h2>Hoje</h2></div>
          </div>
          <div class="child-quest-list">
            ${dailyActivities.length ? dailyActivities.map((activity) => `
              <div class="child-quest-item">
                <span class="quest-badge">✓</span>
                <div>
                  <strong>${escapeHtml(activity.name)}</strong>
                  <small>${escapeHtml(activity.subject || 'Tarefa da rotina')}</small>
                </div>
              </div>
            `).join('') : '<div class="empty-panel-message"><strong>Sem missões hoje</strong><span>O responsável vai lançar novas tarefas para você.</span></div>'}
          </div>
        </div>

        <div class="panel child-panel progress-panel">
          <div class="panel-heading">
            <div><p class="eyebrow">PROGRESSO</p><h2>Conquista atual</h2></div>
          </div>
          <div class="child-progress-box">
            <div class="progress-track"><i style="width:${levelData.percentage}%"></i></div>
            <div class="child-progress-meta"><span>Fase atual</span><strong>${levelData.percentage}%</strong></div>
          </div>
          <div class="child-badges">
            <span>🏆 XP ${progression.totalXp || 0}</span>
            <span>🎯 ${Number(progression.points || 0)} pontos</span>
            <span>🌟 nível ${levelData.level}</span>
          </div>
        </div>
      </section>

      <section class="panel child-panel full-width challenge-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">SALA DE DESAFIOS</p><h2>Provas para jogar</h2></div>
        </div>
        <div class="child-exam-grid">
          ${nextExam.length ? nextExam.map((exam) => `
            <article class="child-exam-card">
              <div class="exam-card-top">
                <span class="exam-tag">PROVA</span>
                <strong>${escapeHtml(exam.name)}</strong>
              </div>
              <p>${exam.question_count} questões · ${escapeHtml(exam.subjects?.[0]?.subject || 'Matéria')}</p>
              <button class="primary-button child-exam-start" type="button" data-exam-id="${escapeHtml(exam.id)}">Jogar</button>
            </article>
          `).join('') : '<div class="empty-panel-message"><strong>Nenhuma prova disponível</strong><span>Fique de olho: novas aventuras chegam em breve.</span></div>'}
        </div>
      </section>
    </div>
  `;
}

function childProfilePage() {
  const child = getCurrentChildProfile();
  if (!child) return emptyPage('Perfil infantil', 'Cadastre uma criança para visualizar o perfil.');
  const progression = readProgression(child.id);
  const levelData = getLevelProgress(progression.totalXp || 0);
  const avatar = getChildProfileAvatar(child, '★');
  const inventory = getChildInventory(child.id);
  const unlockedCount = inventory.owned?.length || 0;
  const greeting = getChildGreeting(child.name);

  return `
    <div class="child-app child-game-shell child-profile-shell">
      <header class="child-header">
        <div class="child-greeting">
          <span class="status-chip">HUD</span>
          <strong>${greeting}, ${escapeHtml(child.name)}!</strong>
        </div>
        <div class="child-header-actions">
          <button class="text-button child-logout" type="button" data-child-action="logout">Sair</button>
        </div>
      </header>

      <section class="child-hero child-launcher child-profile-hero">
        <div class="child-launcher-copy">
          <p class="eyebrow child-level-eyebrow">PERFIL DO HERÓI</p>
          <h1>Seu avatar, XP e conquistas em um só lugar</h1>
          <p class="subtitle">Acompanhe o nível, os pontos e o progresso da sua jornada.</p>
        </div>
        <div class="child-hero-art" aria-label="Avatar da criança">${escapeHtml(avatar)}</div>
      </section>

      <nav class="game-bar" aria-label="Menu infantil">
        <button class="game-bar-item" type="button" data-page="crianca"><span>🏠</span><small>Início</small></button>
        <button class="game-bar-item active" type="button" data-page="perfil"><span>🧭</span><small>Perfil</small></button>
        <button class="game-bar-item" type="button" data-page="loja"><span>🛍️</span><small>Loja</small></button>
      </nav>

      <section class="child-status-hud">
        <article class="hud-stat">
          <span>XP</span>
          <strong>${progression.totalXp || 0}</strong>
          <small>${levelData.currentXp}/${levelData.requiredXp}</small>
        </article>
        <article class="hud-stat">
          <span>LEVEL</span>
          <strong>${levelData.level}</strong>
          <small>fases avançadas</small>
        </article>
        <article class="hud-stat">
          <span>PONTOS</span>
          <strong>${Number(progression.points || 0)}</strong>
          <small>acumulados</small>
        </article>
      </section>

      <section class="child-profile-grid">
        <div class="panel child-panel profile-panel">
          <div class="panel-heading">
            <div><p class="eyebrow">AVATAR</p><h2>Meu herói</h2></div>
          </div>
          <div class="profile-hero-card">
            <div class="profile-avatar-large">${escapeHtml(avatar)}</div>
            <div>
              <h3>${escapeHtml(child.name)}</h3>
              <p>Level ${levelData.level} · ${progression.totalXp || 0} XP</p>
            </div>
          </div>
          <div class="profile-meta-list">
            <div><span>Conquistas</span><strong>${Math.max(0, (progression.history || []).length)}</strong></div>
            <div><span>Itens</span><strong>${unlockedCount}</strong></div>
            <div><span>Progresso</span><strong>${levelData.percentage}%</strong></div>
          </div>
        </div>

        <div class="panel child-panel profile-panel">
          <div class="panel-heading">
            <div><p class="eyebrow">EVOLUÇÃO</p><h2>Resumo da jornada</h2></div>
          </div>
          <div class="child-progress-box">
            <div class="progress-track"><i style="width:${levelData.percentage}%"></i></div>
            <div class="child-progress-meta"><span>Progresso atual</span><strong>${levelData.percentage}%</strong></div>
          </div>
          <div class="child-badges">
            <span>🏆 XP ${progression.totalXp || 0}</span>
            <span>🎯 ${Number(progression.points || 0)} pontos</span>
            <span>🌟 nível ${levelData.level}</span>
          </div>
          <button class="primary-button child-exam-start" type="button" data-page="loja">Personalizar avatar</button>
        </div>
      </section>
    </div>
  `;
}

function childStorePage() {
  const child = getCurrentChildProfile();
  if (!child) return emptyPage('Loja infantil', 'Cadastre uma criança para visualizar a loja.');
  const avatar = getChildProfileAvatar(child, '★');
  const inventory = getChildInventory(child.id);
  const progression = readProgression(child.id);
  const points = Number(progression.points || 0);

  return `
    <div class="child-app child-game-shell child-store-shell">
      <header class="child-header">
        <div class="child-greeting">
          <span class="eyebrow">LOJA</span>
          <strong>${escapeHtml(child.name)}</strong>
        </div>
        <div class="child-header-actions">
          <button class="text-button child-logout" type="button" data-child-action="logout">Sair</button>
        </div>
      </header>

      <section class="child-hero child-launcher child-store-hero">
        <div class="child-launcher-copy">
          <p class="eyebrow">PERSONALIZAÇÃO</p>
          <h1>Loja</h1>
          <p class="subtitle">Compre itens, personalize o avatar e continue sua jornada.</p>
        </div>
        <div class="child-hero-art">${escapeHtml(avatar)}</div>
      </section>

      <nav class="game-bar" aria-label="Menu infantil">
        <button class="game-bar-item" type="button" data-page="crianca"><span>🏠</span><small>Início</small></button>
        <button class="game-bar-item" type="button" data-page="perfil"><span>🧭</span><small>Perfil</small></button>
        <button class="game-bar-item active" type="button" data-page="loja"><span>🛍️</span><small>Loja</small></button>
      </nav>

      <section class="panel child-panel profile-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">ARMAZENAMENTO</p><h2>Itens desbloqueados</h2></div>
        </div>
        <div class="store-items-grid">
            ${CHILD_STORE_CATALOG.map((item) => {
              const owned = inventory.owned.includes(item.id);
              const equipped = inventory.selected === item.emoji;
              const priceText = item.cost ? `${item.cost} pts` : 'Grátis';
              const actionLabel = owned ? (equipped ? 'Equipado' : 'Usar') : `Comprar · ${priceText}`;
              return `
                <article class="store-item-card${equipped ? ' equipped' : ''}">
                  <div class="store-item-art">${escapeHtml(item.emoji)}</div>
                  <div class="store-item-copy">
                    <strong>${escapeHtml(item.name)}</strong>
                    <small>${owned ? 'Disponível' : `Custa ${priceText}`}</small>
                    <span class="store-item-rarity">${escapeHtml(item.rarity || 'comum')}</span>
                  </div>
                  <button class="primary-button store-item-button${owned && !equipped ? ' secondary' : ''}" type="button" data-store-item="${escapeHtml(item.id)}" data-store-action="${owned ? 'equip' : 'buy'}" ${owned && equipped ? 'disabled' : ''}>${actionLabel}</button>
                </article>
              `;
            }).join('')}
          </div>
          <button class="text-button child-profile-back" type="button" data-page="crianca">Voltar ao painel</button>
        </div>
      </section>
    </div>
  `;
}

function collectChildExamAnswers(form) {
  const answers = {};
  form.querySelectorAll('[name^="question-"]').forEach((field) => {
    const questionId = field.name.replace('question-', '');
    if (field.type === 'radio' && !field.checked) return;
    answers[questionId] = field.value.trim();
  });
  return answers;
}

function normalizeExamText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evaluateOpenQuestionAnswer(answer, referenceAnswer) {
  const normalizedAnswer = normalizeExamText(answer);
  const normalizedReference = normalizeExamText(referenceAnswer);
  if (!normalizedAnswer || !normalizedReference) return 0;

  const answerWords = new Set(normalizedAnswer.split(' ').filter(Boolean));
  const referenceWords = normalizedReference.split(' ').filter(Boolean);
  const matchingWords = referenceWords.filter((word) => answerWords.has(word));
  const similarity = referenceWords.length ? matchingWords.length / referenceWords.length : 0;

  return similarity >= 0.35 || normalizedAnswer.includes(normalizedReference.slice(0, 32)) ? 1 : 0;
}

function scoreChildExam(session, answers) {
  return (session.exam.questions || []).reduce((score, question) => {
    const answer = answers[question.id];
    if (!answer) return score;

    if (question.question_type === 'multiple_choice') {
      return score + (answer === question.correct_option ? Number(question.points) || 0 : 0);
    }

    const isCorrect = evaluateOpenQuestionAnswer(answer, question.reference_answer || question.referenceAnswer || '') === 1;
    return score + (isCorrect ? Number(question.points) || 0 : 0);
  }, 0);
}

async function submitChildExam(expired = false) {
  if (!childExamSession || childExamSession.submitting) return;
  childExamSession.submitting = true;
  clearInterval(childExamTimer);
  const form = document.querySelector('[data-child-exam-form]');
  const answers = form ? collectChildExamAnswers(form) : childExamSession.answers;
  childExamSession.answers = answers;
  const questions = childExamSession.exam.questions || [];
  const totalPossibleScore = questions.reduce((total, question) => total + (Number(question.points) || 0), 0);
  const examScore = scoreChildExam(childExamSession, answers);
  const answerRows = questions.filter((question) => answers[question.id]).map((question) => {
    const answer = answers[question.id];
    const isCorrect = question.question_type === 'multiple_choice'
      ? answer === question.correct_option
      : evaluateOpenQuestionAnswer(answer, question.reference_answer || question.referenceAnswer || '') === 1;
    const awardedPoints = isCorrect ? Number(question.points) || 0 : 0;
    return { questionId: question.id, answerText: answer, isCorrect, awardedPoints };
  });
  try {
    await window.MyKidsData.saveExamAttempt({ examId: childExamSession.exam.id, childId: childExamSession.exam.child_id, status: 'submitted', answers: answerRows, score: examScore, startedAt: new Date(childExamSession.startedAt).toISOString() });
    const examDate = new Date().toISOString().slice(0, 10);
    const examXp = Number(childExamSession.exam.xp_total) || 0;
    const examPoints = Number(childExamSession.exam.points_total) || 0;
    const scoreRatio = totalPossibleScore > 0 ? examScore / totalPossibleScore : 0;
    const awardedXp = Math.round(examXp * scoreRatio);
    const awardedPoints = Math.round(examPoints * scoreRatio);
    awardProgression(childExamSession.exam.child_id, childExamSession.exam.name, awardedXp, awardedPoints, 'special', childExamSession.exam.id, examDate, 'Prova aplicada');
    childExamSession = null;
    navigate('crianca');
    showToast(expired ? 'O tempo acabou. A prova foi encerrada e sua pontuação foi calculada pela taxa de acerto.' : 'Prova finalizada e pontuada pela taxa de acerto.');
  } catch (error) {
    childExamSession.submitting = false;
    showToast(resolveErrorMessage(error, 'Não foi possível finalizar a prova.'));
  }
}

function bindChildPage() {
  document.querySelectorAll('.game-bar-item').forEach((button) => {
    if (button.dataset.boundChildNav === 'true') return;
    button.dataset.boundChildNav = 'true';
    button.addEventListener('click', () => {
      const nextPage = button.dataset.page || 'crianca';
      navigate(nextPage);
    });
  });

  document.querySelectorAll('.avatar-option').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach((option) => option.classList.toggle('selected', option === button));
      button.setAttribute('data-selected', 'true');
    });
  });

  document.querySelectorAll('[data-store-item]').forEach((button) => {
    button.addEventListener('click', () => {
      const child = getCurrentChildProfile();
      if (!child) return;
      const itemId = button.dataset.storeItem;
      const catalogItem = CHILD_STORE_CATALOG.find((item) => item.id === itemId);
      const inventory = getChildInventory(child.id);
      const progression = readProgression(child.id);
      const availablePoints = Number(progression.points || 0);
      if (!catalogItem) return;

      if (button.dataset.storeAction === 'buy') {
        if (availablePoints < catalogItem.cost) {
          showToast(`Faltam ${Math.max(0, catalogItem.cost - availablePoints)} pontos para comprar ${catalogItem.name}.`);
          return;
        }
        progression.points = Math.max(0, availablePoints - catalogItem.cost);
        writeProgression(child.id, progression);
        inventory.owned = Array.from(new Set([...inventory.owned, itemId]));
        inventory.selected = catalogItem.emoji;
        writeChildInventory(child.id, inventory);
        showToast(`${catalogItem.name} comprado e equipado.`);
        navigate('loja');
        return;
      }

      inventory.selected = catalogItem.emoji;
      writeChildInventory(child.id, inventory);
      showToast(`${catalogItem.name} agora está no perfil da criança.`);
      navigate('loja');
    });
  });

  document.querySelector('[data-child-action="save-avatar"]')?.addEventListener('click', () => {
    const selected = document.querySelector('.avatar-option.selected');
    const child = getCurrentChildProfile();
    if (!child || !selected) return;
    const avatar = selected.dataset.avatarSelect;
    localStorage.setItem(`mykids-child-avatar-${child.id}`, avatar);
    showToast('Avatar salva no perfil da criança.');
    navigate('loja');
  });

  document.querySelectorAll('.child-exam-start').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const exam = await window.MyKidsData.getExam(button.dataset.examId);
      childExamSession = { exam, startedAt: Date.now(), answers: {}, submitting: false };
      navigate('crianca');
      childExamTimer = setInterval(() => {
        const countdown = document.querySelector('#exam-countdown');
        if (!countdown || !childExamSession) return;
        const remaining = Math.max(0, Number(childExamSession.exam.duration_minutes) * 60 - Math.floor((Date.now() - childExamSession.startedAt) / 1000));
        countdown.textContent = formatExamTime(remaining);
        countdown.classList.toggle('is-warning', remaining <= 60);
        if (remaining === 0) submitChildExam(true);
      }, 1000);
    } catch (error) { button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível abrir a prova.')); }
  }));
  document.querySelector('[data-child-exam-form]')?.addEventListener('submit', (event) => { event.preventDefault(); submitChildExam(); });
  document.querySelector('[data-page="crianca"]')?.addEventListener('click', () => navigate('crianca'));
}

function settingsPage() {
  const familyName = familyData.family?.name || '';
  const accessEntries = readChildAccessList();
  const childAccessRows = (familyData.children || []).map((child) => {
    const entry = accessEntries.find((item) => item.childId === child.id);
    return `
      <div class="child-access-row" data-child-id="${escapeHtml(child.id)}">
        <div class="child-access-header">
          <strong>${escapeHtml(child.name || 'Criança')}</strong>
          <span>${child.age ? `${child.age} anos` : 'Sem idade'}</span>
        </div>
        <label>
          E-mail infantil
          <input type="email" name="child-email" value="${escapeHtml(entry?.email || '')}" placeholder="helenadesouza@mykids.com.br" autocomplete="username" />
        </label>
        <label>
          Senha infantil
          <div class="password-field">
            <input type="password" name="child-password" value="" placeholder="@Helena10" autocomplete="new-password" />
            <button type="button" class="password-toggle" data-toggle-password aria-label="Mostrar senha">Mostrar</button>
          </div>
        </label>
      </div>
    `;
  }).join('') || '<div class="empty-panel-message"><strong>Nenhuma criança cadastrada</strong><span>Adicione uma criança para configurar o acesso infantil.</span></div>';

  return `<div class="page-intro"><div><p class="eyebrow">ADMINISTRAÇÃO DA FAMÍLIA</p><h1>Configurações</h1><p class="subtitle">Mantenha a experiência da família sempre alinhada.</p></div></div><section class="panel settings-panel"><p class="eyebrow">INFORMAÇÕES BÁSICAS</p><h2>Perfil da família</h2><p class="settings-copy">Esses dados aparecem apenas para os responsáveis da família.</p><div class="form-grid"><label>Nome da família<input value="${familyName}" placeholder="Nome da família"></label><label>Nome do responsável<input placeholder="Nome do responsável"></label><label class="full-field">E-mail principal<input placeholder="E-mail da conta" type="email"></label></div><div class="settings-divider"></div><form data-child-access-form><p class="eyebrow">ACESSO INFANTIL</p><h2>Login da criança</h2><p class="settings-copy">Cada criança pode ter um e-mail e senha próprios para entrar no painel infantil.</p><div class="child-access-grid">${childAccessRows}</div><button class="primary-button settings-save" type="submit">Salvar acessos infantis</button></form></section>`;
}

const managedPageSelection = { rotina: '', responsabilidades: '', estudos: '' };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function managedStorageKey(type) {
  return `mykids-${type}-${familyData.family?.id || 'local'}`;
}

function readManagedItems(type) {
  try { return JSON.parse(localStorage.getItem(managedStorageKey(type)) || '[]'); } catch { return []; }
}

function writeManagedItems(type, items) {
  localStorage.setItem(managedStorageKey(type), JSON.stringify(items));
}

function studyStorageKey() {
  return `mykids-studies-${familyData.family?.id || 'local'}`;
}

function readStudySubjects() {
  if (studySubjectsLoaded) return studySubjects;
  try { return JSON.parse(localStorage.getItem(studyStorageKey()) || '[]'); } catch { return []; }
}

function writeStudySubjects(subjects) {
  studySubjects = subjects;
  localStorage.setItem(studyStorageKey(), JSON.stringify(subjects));
}

const XP_RULES = {
  repetitive: { floor: 0.25, decay: 0.18 },
  study: { floor: 0.7, decay: 0.08 },
  special: { floor: 1, decay: 0 }
};

function progressionStorageKey(childId) {
  return `mykids-progression-${familyData.family?.id || 'local'}-${childId}`;
}

function clearAllProgressionStorage() {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('mykids-progression-')) {
      localStorage.removeItem(key);
    }
  }
}

function zeroFamilyProgression() {
  familyData.children = (familyData.children || []).map((child) => ({ ...child, xp: 0, points: 0 }));
  clearAllProgressionStorage();
}

function readProgression(childId) {
  try {
    const value = JSON.parse(localStorage.getItem(progressionStorageKey(childId)) || '{}');
    const child = familyData.children?.find((entry) => entry.id === childId);
    const safeValue = { totalXp: Number(value.totalXp ?? child?.xp) || 0, points: Number(value.points ?? child?.points) || 0, history: Array.isArray(value.history) ? value.history : [], awarded: Array.isArray(value.awarded) ? value.awarded : [] };
    if (!safeValue.awarded.length && !safeValue.history.length && (!child || Number(child.xp) === 0)) {
      localStorage.removeItem(progressionStorageKey(childId));
      return { totalXp: 0, points: 0, history: [], awarded: [] };
    }
    return safeValue;
  } catch { return { totalXp: 0, points: 0, history: [], awarded: [] }; }
}

function writeProgression(childId, progression) {
  localStorage.setItem(progressionStorageKey(childId), JSON.stringify(progression));
}

function xpRequiredForLevel(level) {
  return Math.ceil(100 * (1.5 ** Math.max(0, level - 1)));
}

function getLevelProgress(totalXp) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level += 1;
  }
  const required = xpRequiredForLevel(level);
  return { level, currentXp: remaining, requiredXp: required, remainingXp: required - remaining, percentage: Math.min(100, Math.floor((remaining / required) * 100)) };
}

function effectiveXp(baseXp, level, type = 'repetitive') {
  const base = Math.max(0, Number(baseXp) || 0);
  const rule = XP_RULES[type] || XP_RULES.repetitive;
  const multiplier = Math.max(rule.floor, 1 / (1 + rule.decay * Math.max(0, level - 1)));
  return base > 0 ? Math.max(1, Math.round(base * multiplier)) : 0;
}

function awardProgression(childId, source, baseXp, points, type, activityId, date, reason) {
  if (!familyData.children?.some((child) => child.id === childId) || !activityId) return { awarded: false, progression: readProgression(childId) };
  const progression = readProgression(childId);
  const awardKey = `${activityId}:${date}`;
  if (progression.awarded.includes(awardKey)) return { awarded: false, progression };
  const before = getLevelProgress(progression.totalXp);
  const xpGained = effectiveXp(baseXp, before.level, type);
  const entry = { id: `xp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date, source, activityId, reason, type, baseXp: Number(baseXp) || 0, xpGained, level: before.level, points: Number(points) || 0 };
  progression.totalXp += xpGained;
  progression.points += Number(points) || 0;
  progression.awarded.push(awardKey);
  progression.history.push(entry);
  writeProgression(childId, progression);
  const after = getLevelProgress(progression.totalXp);
  if (after.level > before.level) {
    for (let level = before.level + 1; level <= after.level; level += 1) progression.history.push({ id: `level-${Date.now()}-${level}`, date, type: 'level_up', level, reason: 'Subida de nível', xpGained: 0, baseXp: 0, points: 0 });
    writeProgression(childId, progression);
  }
  return { awarded: true, xpGained, points: Number(points) || 0, level: before.level, levelUp: after.level > before.level, newLevel: after.level, progression };
}

function reverseProgression(childId, activityId, date) {
  const progression = readProgression(childId);
  const awardKey = `${activityId}:${date}`;
  const entry = progression.history.find((item) => item.activityId === activityId && item.date === date && item.type !== 'level_up');
  if (!entry && !progression.awarded.includes(awardKey)) return false;
  progression.totalXp = Math.max(0, progression.totalXp - (entry?.xpGained || 0));
  progression.points = Math.max(0, progression.points - (entry?.points || 0));
  progression.awarded = progression.awarded.filter((key) => key !== awardKey);
  const transactions = progression.history.filter((item) => item.type !== 'level_up' && !(item.activityId === activityId && item.date === date));
  const rebuiltHistory = [];
  let totalXp = 0;
  for (const transaction of transactions) {
    const before = getLevelProgress(totalXp);
    totalXp += transaction.xpGained || 0;
    const after = getLevelProgress(totalXp);
    rebuiltHistory.push(transaction);
    for (let level = before.level + 1; level <= after.level; level += 1) rebuiltHistory.push({ id: `level-rebuilt-${Date.now()}-${level}`, date: transaction.date, type: 'level_up', level, reason: 'Subida de nível', xpGained: 0, baseXp: 0, points: 0 });
  }
  progression.history = rebuiltHistory;
  writeProgression(childId, progression);
  return true;
}

function reverseExamProgression(exam) {
  if (!exam?.id || !exam?.child_id) return false;
  const progression = readProgression(exam.child_id);
  const dates = [...new Set(progression.history.filter((item) => item.activityId === exam.id && item.type !== 'level_up').map((item) => item.date))];
  let reversed = false;
  for (const date of dates) {
    reversed = reverseProgression(exam.child_id, exam.id, date) || reversed;
  }
  return reversed;
}

function childProgress(childId) {
  const progression = readProgression(childId);
  return { ...getLevelProgress(progression.totalXp), totalXp: progression.totalXp, points: progression.points };
}

function progressPanel(childId) {
  const progress = childProgress(childId);
  const history = readProgression(childId).history.slice(-4).reverse();
  const historyMarkup = history.length ? `<div class="xp-history"><p class="eyebrow">HISTÓRICO RECENTE</p>${history.map((entry) => `<div class="xp-history-row"><span>${entry.type === 'level_up' ? '★' : 'ϟ'}</span><div><strong>${escapeHtml(entry.reason)}</strong><small>${entry.date} · Nível ${entry.level}${entry.type === 'level_up' ? '' : ` · Base ${entry.baseXp} XP`}</small></div><b>${entry.type === 'level_up' ? `Nível ${entry.level}` : `+${entry.xpGained} XP`}</b></div>`).join('')}</div>` : '';
  return `<section class="xp-progress-panel"><div class="xp-level-badge"><span>NÍVEL</span><strong>${progress.level}</strong></div><div class="xp-progress-content"><div class="xp-progress-heading"><div><p class="eyebrow">PROGRESSÃO</p><h2>Próximo nível</h2></div><strong>${progress.currentXp} <small>/ ${progress.requiredXp} XP</small></strong></div><div class="xp-progress-track"><i style="width:${progress.percentage}%"></i></div><div class="xp-progress-footer"><span>${progress.percentage}% concluído</span><span>Faltam ${progress.remainingXp} XP</span><span>${progress.points} pontos</span></div></div>${historyMarkup}</section>`;
}

function currentChildId(page) {
  return managedPageSelection[page] || familyData.children?.[0]?.id || '';
}

function childPicker(page) {
  const selectedId = currentChildId(page);
  const selectedChild = familyData.children?.find((child) => child.id === selectedId) || familyData.children?.[0];
  const selectedName = selectedChild?.name || 'Nenhuma criança cadastrada';
  const selectedInitial = selectedName[0]?.toUpperCase() || '?';
  const menu = familyData.children?.length ? familyData.children.map((child) => `<button class="child-picker-option${child.id === selectedId ? ' selected' : ''}" type="button" data-child-id="${escapeHtml(child.id)}"><span class="avatar">${escapeHtml((child.avatar || child.name?.[0] || '?').slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(child.name || 'Sem nome')}</strong><small>${child.age ? `${escapeHtml(child.age)} anos` : 'Idade não informada'}</small></span>${child.id === selectedId ? '<b>✓</b>' : ''}</button>`).join('') : '<div class="child-picker-empty">Nenhuma criança cadastrada</div>';
  return `<div class="child-picker" data-child-picker="${page}"><button class="child-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"${familyData.children?.length ? '' : ' disabled'}><span class="avatar">${escapeHtml(selectedInitial)}</span><span><small>Criança selecionada</small><strong>${escapeHtml(selectedName)}</strong></span><span class="child-picker-chevron">⌄</span></button><div class="child-picker-menu" role="listbox" hidden>${menu}</div></div>`;
}

function managedToolbar(page, title, description) {
  return `<div class="page-intro managed-page-intro"><div><p class="eyebrow">${title.toUpperCase()}</p><h1>${title}</h1><p class="subtitle">${description}</p></div><button class="primary-button managed-add-button" type="button" data-managed-action="add"${familyData.children?.length ? '' : ' disabled'}>+ Adicionar</button></div><div class="managed-toolbar"><div><span class="managed-toolbar-label">Criança</span>${childPicker(page)}</div><span class="managed-toolbar-note">Os dados ficam vinculados ao perfil selecionado.</span></div><div id="managed-form-host"></div>`;
}

function routinePage() {
  const childId = currentChildId('rotina');
  const routines = readManagedItems('routines').filter((item) => item.childId === childId);
  const list = routines.length ? routines.map((item) => `<article class="managed-card"><div class="managed-card-icon">◷</div><div class="managed-card-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || 'Sem observações')}</p><div class="managed-card-meta"><span>${escapeHtml(item.time || 'Sem horário')}</span><span>${escapeHtml(item.frequency)}</span></div></div><div class="managed-card-actions"><button class="text-button" type="button" data-managed-action="edit" data-item-id="${escapeHtml(item.id)}">Editar</button><button class="text-button danger-text" type="button" data-managed-action="delete" data-item-id="${escapeHtml(item.id)}">Excluir</button></div></article>`).join('') : '<div class="empty-panel-message"><strong>Nenhuma rotina cadastrada</strong><span>Adicione os deveres diários para lembrar a criança do que precisa fazer.</span></div>';
  return `${managedToolbar('rotina', 'Rotina', 'Mostre os deveres diários da criança sem transformar a rotina em uma lista de conclusão.')}<section class="panel managed-list-panel"><div class="panel-heading"><div><p class="eyebrow">DEVERES DA CRIANÇA</p><h2>Rotinas cadastradas</h2></div><span class="soft-label">${routines.length} ${routines.length === 1 ? 'item' : 'itens'}</span></div><div class="managed-list">${list}</div></section>`;
}

function activityIsScheduled(activity, date = new Date()) {
  const recurrence = activity.recurrence || { type: 'daily' };
  if (activity.created_at && scheduleDateKey(date) < scheduleDateKey(new Date(activity.created_at))) return false;
  const day = date.getDay();
  const dayOfMonth = date.getDate();
  if (recurrence.type === 'daily') return true;
  if (recurrence.type === 'monthly') return Number(recurrence.day_of_month) === dayOfMonth;
  if (recurrence.type === 'weekly') return (recurrence.weekdays || []).includes(day);
  if (recurrence.type === 'custom') return (recurrence.weekdays || []).includes(day);
  return false;
}

function activityRecurrenceLabel(recurrence = {}) {
  const labels = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal', custom: 'Personalizada' };
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const days = (recurrence.weekdays || []).map((day) => weekdays[day]).join(', ');
  return recurrence.type === 'monthly' ? `Mensal, dia ${recurrence.day_of_month}` : `${labels[recurrence.type] || 'Diária'}${days ? ` · ${days}` : ''}`;
}

function formatActivityTime(value) {
  return value ? String(value).slice(0, 5) : '--:--';
}

function studySubjectOptions() {
  const subjects = readStudySubjects().filter((subject) => subject.childId === currentChildId('responsabilidades'));
  return subjects.length ? subjects.map((subject) => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join('') : '<option value="">Nenhuma matéria cadastrada</option>';
}

function activityModal(activity = {}) {
  const recurrence = activity.recurrence || { type: 'daily', weekdays: [], day_of_month: '' };
  const isStudy = activity.kind === 'study';
  const isExam = activity.kind === 'exam';
  const childId = activity.child_id || currentChildId('responsabilidades');
  const selectedSubject = readStudySubjects().find((subject) => subject.childId === childId && subject.name === activity.subject);
  const subjectOptions = studySubjectOptions().replace(`value="${escapeHtml(selectedSubject?.id || '')}"`, `value="${escapeHtml(selectedSubject?.id || '')}" selected`);
  return `<div class="activity-modal-backdrop" role="presentation"><section class="activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title"><div class="activity-modal-header"><div><p class="eyebrow">ATIVIDADES DA CRIANÇA</p><h2 id="activity-modal-title">${activity.id ? 'Editar atividade' : 'Nova atividade'}</h2></div><button class="modal-close" type="button" data-activity-action="close" aria-label="Fechar">×</button></div><form class="activity-form" data-activity-form data-activity-id="${escapeHtml(activity.id || '')}"><input type="hidden" name="child_id" value="${escapeHtml(childId)}"><div class="activity-type-switch" role="radiogroup" aria-label="Tipo da atividade"><button type="button" class="activity-type-option${isStudy ? ' selected' : ''}" data-kind="study">Estudo</button><button type="button" class="activity-type-option${!isStudy && !isExam ? ' selected' : ''}" data-kind="responsibility">Nova responsabilidade</button><button type="button" class="activity-type-option${isExam ? ' selected' : ''}" data-kind="exam">Prova</button></div><input type="hidden" name="kind" value="${isExam ? 'exam' : isStudy ? 'study' : 'responsibility'}"><div class="activity-form-grid"><label>Nome da atividade<input name="name" required maxlength="120" value="${escapeHtml(activity.name || '')}"><span class="field-error" data-error-for="name"></span></label><div class="study-only${isStudy ? '' : ' hidden'}"><label>Matéria<select name="subject_id"><option value="">Selecione uma matéria</option>${subjectOptions}</select><span class="field-error" data-error-for="subject_id"></span></label></div><div class="study-only${isStudy ? '' : ' hidden'}"><label>Submatéria<select name="subtopic"><option value="">Selecione uma submatéria</option></select><span class="field-error" data-error-for="subtopic"></span></label></div><div class="exam-only${isExam ? '' : ' hidden'}"><label>Data da prova<input name="exam_date" type="date" required value="${escapeHtml(activity.scheduled_date || '')}"><span class="field-error" data-error-for="exam_date"></span></label></div><div class="exam-only${isExam ? '' : ' hidden'}"><label>Matérias e resumo dos temas<span class="exam-subject-rows"><span class="exam-subject-row"><select name="exam_subject"><option value="">Selecione uma matéria</option>${studySubjectOptions()}</select><textarea name="exam_summary" rows="2" placeholder="Resumo dos temas"></textarea></span></span><button class="text-button add-exam-subject" type="button">+ Adicionar matéria</button><span class="field-error" data-error-for="exam_subjects"></span></label></div><label class="${isExam ? 'hidden' : ''}">Recorrência<select name="recurrence_type"><option value="daily"${recurrence.type === 'daily' ? ' selected' : ''}>Diária</option><option value="weekly"${recurrence.type === 'weekly' ? ' selected' : ''}>Semanal</option><option value="monthly"${recurrence.type === 'monthly' ? ' selected' : ''}>Mensal</option><option value="custom"${recurrence.type === 'custom' ? ' selected' : ''}>Personalizada</option></select><span class="field-error" data-error-for="recurrence"></span></label><label>Horário de início<input name="start_time" type="time" value="${escapeHtml(activity.start_time || '')}"><span class="field-error" data-error-for="start_time"></span></label><label class="${isExam ? 'hidden' : ''}">Duração (minutos)<input name="duration_minutes" type="number" min="1" max="1440" value="${escapeHtml(activity.duration_minutes || '')}"><span class="field-error" data-error-for="duration_minutes"></span></label><label class="full-field">Observações<textarea name="notes" rows="3" maxlength="500">${escapeHtml(activity.notes || '')}</textarea></label></div><div class="activity-form-actions"><button class="outline-button" type="button" data-activity-action="close">Cancelar</button><button class="primary-button activity-save-button" type="submit">${isExam ? 'Criar prova' : 'Salvar atividade'}</button></div></form></section></div>`;
}

function closeExamModal() {
  document.querySelector('.exam-edit-modal-backdrop')?.remove();
  if (!document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop, .activity-modal-backdrop')) document.body.classList.remove('modal-open');
}

function examEditModal(exam) {
  const subjects = exam.subjects || [];
  const rows = subjects.map((item) => `<div class="exam-edit-subject-row"><input name="exam_subject" required maxlength="80" value="${escapeHtml(item.subject || '')}" placeholder="Matéria"><textarea name="exam_summary" required rows="2" maxlength="500" placeholder="Resumo dos temas">${escapeHtml(item.summary || '')}</textarea><button class="text-button danger-text exam-edit-remove-subject" type="button">Remover</button></div>`).join('');
  return `<div class="exam-edit-modal-backdrop" role="presentation"><section class="exam-edit-modal" role="dialog" aria-modal="true" aria-labelledby="exam-edit-modal-title"><div class="activity-modal-header"><div><p class="eyebrow">AVALIAÇÕES</p><h2 id="exam-edit-modal-title">Editar prova</h2></div><button class="modal-close" type="button" data-exam-modal-action="close" aria-label="Fechar">×</button></div><form data-exam-edit-form data-exam-id="${escapeHtml(exam.id)}"><div class="exam-edit-fields"><label>Nome da prova<input name="name" required maxlength="120" value="${escapeHtml(exam.name || '')}"></label><label>Data<input name="scheduled_date" type="date" required value="${escapeHtml(exam.scheduled_date || '')}"></label><label>Horário<input name="start_time" type="time" required value="${escapeHtml(exam.start_time || '')}"></label><label>Duração (minutos)<input name="duration_minutes" type="number" min="1" max="1440" required value="${escapeHtml(exam.duration_minutes || 30)}"></label><label>XP total<input name="xp_total" type="number" min="0" required value="${escapeHtml(exam.xp_total || 0)}"></label><label>Pontos totais<input name="points_total" type="number" min="0" required value="${escapeHtml(exam.points_total || 0)}"></label></div><div class="exam-edit-subject-heading"><div><p class="eyebrow">CONTEÚDO</p><h3>Matérias e resumos</h3></div><button class="text-button exam-edit-add-subject" type="button">+ Adicionar matéria</button></div><div class="exam-edit-subjects">${rows}</div><div class="study-subject-modal-actions"><button class="outline-button" type="button" data-exam-modal-action="close">Cancelar</button><button class="primary-button" type="submit">Salvar alterações</button></div></form></section></div>`;
}

function bindExamEditModal(exam) {
  const modal = document.querySelector('.exam-edit-modal-backdrop');
  const form = modal?.querySelector('[data-exam-edit-form]');
  if (!form) return;
  bindModalFrame(modal, closeExamModal);
  const subjectsContainer = form.querySelector('.exam-edit-subjects');
  modal.querySelectorAll('[data-exam-modal-action="close"]').forEach((button) => button.addEventListener('click', closeExamModal));
  modal.querySelector('.exam-edit-add-subject')?.addEventListener('click', () => subjectsContainer.insertAdjacentHTML('beforeend', '<div class="exam-edit-subject-row"><input name="exam_subject" required maxlength="80" placeholder="Matéria"><textarea name="exam_summary" required rows="2" maxlength="500" placeholder="Resumo dos temas"></textarea><button class="text-button danger-text exam-edit-remove-subject" type="button">Remover</button></div>'));
  subjectsContainer.addEventListener('click', (event) => event.target.closest('.exam-edit-remove-subject')?.closest('.exam-edit-subject-row')?.remove());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const subjects = data.getAll('exam_subject').map((subject, index) => ({ subject: subject.trim(), summary: data.getAll('exam_summary')[index]?.trim() || '' })).filter((item) => item.subject && item.summary);
    if (!subjects.length) { showToast('Adicione ao menos uma matéria com resumo.'); return; }
    button.disabled = true;
    try {
      const questions = generateExamQuestions(subjects, data.get('xp_total'), data.get('points_total'));
      await window.MyKidsData.updateExam({ examId: exam.id, name: data.get('name').trim(), scheduledDate: data.get('scheduled_date'), startTime: data.get('start_time'), durationMinutes: Number(data.get('duration_minutes')), subjects, questions, xpTotal: Number(data.get('xp_total')), pointsTotal: Number(data.get('points_total')) });
      await loadExams();
      closeExamModal();
      refreshActivityPage();
      showToast('Prova atualizada.');
    } catch (error) { button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível atualizar a prova.')); }
  });
}

function openExamEditModal(exam) {
  if (document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop, .exam-edit-modal-backdrop, .activity-modal-backdrop')) return;
  document.body.insertAdjacentHTML('beforeend', examEditModal(exam));
  bindExamEditModal(exam);
}

function responsibilityPage() {
  const childId = currentChildId('responsabilidades');
  const selectedDateKey = scheduleDateKey(selectedScheduleDate);
  const childActivities = activities.filter((activity) => activity.child_id === childId && activityIsScheduled(activity, selectedScheduleDate));
  const today = selectedDateKey;
  const selectedChildName = familyData.children.find((child) => child.id === childId)?.name || 'Criança';
  const list = childActivities.length ? childActivities.map((activity) => { const status = activity.occurrences?.find((occurrence) => occurrence.occurrence_date === today)?.status || 'pending'; const completed = status === 'completed'; return `<article class="managed-card responsibility-card${completed ? ' is-complete' : ''}"><button class="completion-toggle" type="button" data-activity-action="toggle" data-activity-id="${escapeHtml(activity.id)}" data-child-id="${escapeHtml(activity.child_id)}" aria-pressed="${completed}">${completed ? '✓' : ''}</button><div class="managed-card-icon">${activity.kind === 'study' ? '▣' : '✓'}</div><div class="managed-card-content"><h3>${escapeHtml(activity.name)}</h3><p>${activity.kind === 'study' ? `Estudo · ${escapeHtml(activity.subject || '')}${activity.subtopic ? ` · ${escapeHtml(activity.subtopic)}` : ''}` : 'Nova responsabilidade'}</p><div class="managed-card-meta"><span>${escapeHtml(selectedChildName)}</span><span>${activityRecurrenceLabel(activity.recurrence)}</span><span>${formatActivityTime(activity.start_time)}</span>${activity.duration_minutes ? `<span>${activity.duration_minutes} min</span>` : ''}<span>${activity.points_base || 0} pontos</span><span>${activity.xp_base || 0} XP</span><span>${completed ? 'Concluída' : 'Pendente'}</span></div></div><div class="managed-card-actions"><button class="text-button" type="button" data-activity-action="edit" data-activity-id="${escapeHtml(activity.id)}">Editar</button><button class="text-button danger-text" type="button" data-activity-action="delete" data-activity-id="${escapeHtml(activity.id)}">Excluir</button></div></article>`; }).join('') : '<div class="empty-panel-message"><strong>Nenhuma atividade programada</strong><span>Adicione um estudo ou uma responsabilidade para esta criança.</span></div>';
  const childExams = exams.filter((exam) => exam.child_id === childId);
  const examList = childExams.length ? childExams.map((exam) => `<article class="managed-card exam-card"><div class="managed-card-icon">★</div><div class="managed-card-content"><h3>${escapeHtml(exam.name)}</h3><p>Prova com ${exam.question_count} questões · ${exam.subjects.length} matéria(s)</p><div class="managed-card-meta"><span>${escapeHtml(exam.scheduled_date)}</span><span>${formatActivityTime(exam.start_time)}</span><span>10 objetivas · 5 abertas</span><span>${exam.xp_total || 0} XP</span><span>${exam.points_total || 0} pontos</span></div></div><div class="managed-card-actions"><button class="text-button" type="button" data-exam-action="edit" data-exam-id="${escapeHtml(exam.id)}">Editar</button><button class="text-button danger-text" type="button" data-exam-action="delete" data-exam-id="${escapeHtml(exam.id)}">Excluir</button></div></article>`).join('') : '<div class="empty-panel-message"><strong>Nenhuma prova agendada</strong><span>As provas criadas para esta criança aparecerão aqui.</span></div>';
  return `${managedToolbar('responsabilidades', 'Responsabilidades', 'Cadastre estudos, deveres recorrentes e provas para acompanhar a criança.').replace('data-managed-action="add"', 'data-activity-action="add"').replace('+ Adicionar', '+ Adicionar atividade')}${scheduleDayNavigator()}${progressPanel(childId)}${activitiesError ? `<div class="inline-error">${escapeHtml(activitiesError)}</div>` : ''}<section class="panel managed-list-panel"><div class="panel-heading"><div><p class="eyebrow">ATIVIDADES DA CRIANÇA</p><h2>Atividades cadastradas</h2></div><span class="soft-label">${childActivities.length} ${childActivities.length === 1 ? 'atividade' : 'atividades'}</span></div><div class="managed-list">${list}</div></section><section class="panel managed-list-panel exam-list-panel"><div class="panel-heading"><div><p class="eyebrow">AVALIAÇÕES</p><h2>Provas agendadas</h2></div><span class="soft-label">${childExams.length}</span></div><div class="managed-list">${examList}</div></section>`;
}

function studyPage() {
  const childId = currentChildId('estudos');
  const subjects = readStudySubjects().filter((subject) => subject.childId === childId).sort((left, right) => left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }));
  const progressionHistory = readProgression(childId).history;
  const subjectTotals = (subject) => {
    const topicIds = new Set((subject.topics || []).map((topic) => topic.id));
    const activityIds = new Set(activities.filter((activity) => activity.child_id === childId && activity.subject === subject.name).map((activity) => activity.id));
    return progressionHistory.filter((entry) => topicIds.has(entry.activityId) || activityIds.has(entry.activityId)).reduce((total, entry) => ({ xp: total.xp + (Number(entry.xpGained) || 0), points: total.points + (Number(entry.points) || 0) }), { xp: 0, points: 0 });
  };
  const topics = subjects.flatMap((subject) => (subject.topics || []).map((topic) => ({ ...topic, subjectId: subject.id, subjectName: subject.name })));
  const subjectList = subjects.length ? subjects.map((subject) => { const totals = subjectTotals(subject); return `<article class="study-subject-card"><div class="study-subject-heading"><div class="managed-card-icon">▣</div><div><h3>${escapeHtml(subject.name)}</h3><span>${(subject.topics || []).length} ${(subject.topics || []).length === 1 ? 'tema' : 'temas'}</span></div><div class="study-subject-summary"><span>${totals.xp} XP</span><span>${totals.points} pontos</span></div><div class="managed-card-actions"><button class="text-button" type="button" data-study-action="edit-subject" data-subject-id="${escapeHtml(subject.id)}">Editar</button><button class="text-button danger-text" type="button" data-study-action="delete-subject" data-subject-id="${escapeHtml(subject.id)}">Excluir</button></div></div><div class="study-topic-list">${(subject.topics || []).length ? subject.topics.map((topic) => `<div class="study-topic"><span class="topic-bullet">•</span><div><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.description || 'Tema pronto para virar uma tarefa de estudo.')}</small></div><div class="managed-card-actions"><button class="text-button" type="button" data-study-action="edit-topic" data-subject-id="${escapeHtml(subject.id)}" data-topic-id="${escapeHtml(topic.id)}">Editar</button><button class="text-button danger-text" type="button" data-study-action="delete-topic" data-subject-id="${escapeHtml(subject.id)}" data-topic-id="${escapeHtml(topic.id)}">Excluir</button></div></div>`).join('') : '<div class="empty-panel-message"><strong>Nenhum tema cadastrado</strong><span>Adicione um tema para criar uma tarefa de estudo.</span></div>'}</div><button class="text-button add-topic-button" type="button" data-study-action="add-topic" data-subject-id="${escapeHtml(subject.id)}">+ Adicionar tema</button></article>`; }).join('') : '<div class="empty-panel-message"><strong>Nenhuma matéria cadastrada</strong><span>Adicione uma matéria e depois seus temas de estudo.</span></div>';
  const taskList = topics.length ? topics.map((topic) => `<button class="study-task${topic.completedDates?.includes(new Date().toISOString().slice(0, 10)) ? ' is-complete' : ''}" type="button" data-study-action="complete-topic" data-subject-id="${escapeHtml(topic.subjectId)}" data-topic-id="${escapeHtml(topic.id)}"><span class="task-icon">${topic.completedDates?.includes(new Date().toISOString().slice(0, 10)) ? '✓' : '▣'}</span><span><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.subjectName)}</small></span><span class="soft-label">${topic.completedDates?.includes(new Date().toISOString().slice(0, 10)) ? 'Concluído hoje' : 'Concluir'}</span></button>`).join('') : '<div class="empty-panel-message"><strong>Nenhuma tarefa de estudo</strong><span>Os temas cadastrados aparecerão aqui como tarefas.</span></div>';
  const targetOptions = familyData.children?.filter((child) => child.id !== childId).map((child) => `<option value="${escapeHtml(child.id)}">${escapeHtml(child.name)}</option>`).join('') || '';
  const replicationControl = targetOptions ? `<div class="study-replication-toolbar"><div><span class="managed-toolbar-label">Replicar matérias para</span><select class="study-replication-target">${targetOptions}</select></div><button class="text-button study-replicate-button" type="button">Replicar matérias</button></div>` : '';
  return `<div class="page-intro managed-page-intro"><div><p class="eyebrow">APRENDIZADO</p><h1>Estudos</h1><p class="subtitle">Cadastre matérias e organize os temas que serão estudados por cada criança.</p></div><button class="primary-button study-add-subject" type="button"${familyData.children?.length ? '' : ' disabled'}>+ Adicionar matéria</button></div><div class="managed-toolbar"><div><span class="managed-toolbar-label">Criança</span>${childPicker('estudos')}</div><span class="managed-toolbar-note">Cada tema aparece automaticamente como tarefa de estudo.</span></div>${replicationControl}<div id="study-form-host"></div>${progressPanel(childId)}<div class="study-content-grid"><section class="panel managed-list-panel"><div class="panel-heading"><div><p class="eyebrow">ORGANIZAÇÃO DO APRENDIZADO</p><h2>Matérias e temas</h2></div><span class="soft-label">${subjects.length} ${subjects.length === 1 ? 'matéria' : 'matérias'}</span></div><div class="study-subject-list">${subjectList}</div></section><section class="panel managed-list-panel study-task-panel"><div class="panel-heading"><div><p class="eyebrow">TAREFAS DE ESTUDO</p><h2>Temas para estudar</h2></div><span class="soft-label">${topics.length} ${topics.length === 1 ? 'tarefa' : 'tarefas'}</span></div><div class="managed-list">${taskList}</div></section></div>`;
}

function studyForm(type, subject, topic) {
  const isTopic = type === 'topic';
  return `<form class="managed-form" data-study-form="${type}" data-subject-id="${escapeHtml(subject?.id || '')}" data-topic-id="${escapeHtml(topic?.id || '')}"><div class="managed-form-heading"><div><p class="eyebrow">${isTopic ? 'TEMA DE ESTUDO' : 'MATÉRIA'}</p><h2>${(isTopic ? topic : subject) ? 'Editar' : 'Adicionar'} ${isTopic ? 'tema' : 'matéria'}</h2></div><button type="button" class="text-button" data-study-action="cancel">Cancelar</button></div><div class="managed-form-grid"><label>${isTopic ? 'Nome do tema' : 'Nome da matéria'}<input name="name" required maxlength="80" value="${escapeHtml(isTopic ? topic?.title || '' : subject?.name || '')}" placeholder="${isTopic ? 'Nome do tema' : 'Nome da matéria'}"></label><label class="full-field">Descrição<textarea name="description" rows="3" maxlength="240" placeholder="Detalhes opcionais">${escapeHtml(isTopic ? topic?.description || '' : subject?.description || '')}</textarea></label></div><div class="managed-form-actions"><button class="primary-button" type="submit">Salvar</button></div></form>`;
}

function renderStudyPage() {
  appView.innerHTML = studyPage();
  bindStudyPage();
}

function bindModalFrame(modal, close) {
  if (!modal || modal.dataset.frameBound === 'true') return;
  modal.dataset.frameBound = 'true';
  document.body.classList.add('modal-open');
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  if (!document.body.dataset.modalEscapeBound) {
    document.body.dataset.modalEscapeBound = 'true';
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop, .exam-edit-modal-backdrop, .activity-modal-backdrop')?.remove();
      if (!document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop, .exam-edit-modal-backdrop, .activity-modal-backdrop')) document.body.classList.remove('modal-open');
    });
  }
}

function closeStudySubjectModal() {
  document.querySelector('.study-subject-modal-backdrop')?.remove();
  if (!document.querySelector('.study-topic-modal-backdrop, .exam-edit-modal-backdrop, .activity-modal-backdrop')) document.body.classList.remove('modal-open');
}

function studySubjectModal(subject) {
  const topics = subject.topics || [];
  const topicRows = topics.map((topic) => `<div class="study-modal-topic-row"><input name="topic_name" maxlength="80" value="${escapeHtml(topic.title || '')}" placeholder="Nome do tema"><textarea name="topic_description" rows="2" maxlength="240" placeholder="Descrição do tema">${escapeHtml(topic.description || '')}</textarea><input type="hidden" name="topic_id" value="${escapeHtml(topic.id || '')}"><button class="text-button danger-text study-modal-remove-topic" type="button" aria-label="Remover tema">Remover</button></div>`).join('');
  return `<div class="study-subject-modal-backdrop" role="presentation"><section class="study-subject-modal" role="dialog" aria-modal="true" aria-labelledby="study-subject-modal-title"><div class="activity-modal-header"><div><p class="eyebrow">ORGANIZAÇÃO DO APRENDIZADO</p><h2 id="study-subject-modal-title">Editar matéria</h2></div><button class="modal-close" type="button" data-study-modal-action="close" aria-label="Fechar">×</button></div><form class="study-subject-modal-form" data-study-subject-modal-form data-subject-id="${escapeHtml(subject.id)}"><div class="study-subject-modal-fields"><label>Nome da matéria<input name="subject_name" required maxlength="80" value="${escapeHtml(subject.name || '')}"></label><label>Descrição<textarea name="subject_description" rows="3" maxlength="240">${escapeHtml(subject.description || '')}</textarea></label></div><div class="study-modal-topics-heading"><div><p class="eyebrow">TEMAS DA MATÉRIA</p><h3>Temas cadastrados</h3></div><button class="text-button study-modal-add-topic" type="button">+ Adicionar tema</button></div><div class="study-modal-topics">${topicRows || '<div class="empty-panel-message study-modal-empty-topics"><strong>Nenhum tema cadastrado</strong><span>Adicione o primeiro tema desta matéria.</span></div>'}</div><div class="study-subject-modal-actions"><button class="outline-button" type="button" data-study-modal-action="close">Cancelar</button><button class="primary-button" type="submit">Salvar alterações</button></div></form></section></div>`;
}

function bindStudySubjectModal(subject) {
  const modal = document.querySelector('.study-subject-modal-backdrop');
  const form = modal?.querySelector('[data-study-subject-modal-form]');
  if (!form) return;
  bindModalFrame(modal, closeStudySubjectModal);
  const topicsContainer = form.querySelector('.study-modal-topics');
  const addTopicRow = () => {
    topicsContainer.querySelector('.study-modal-empty-topics')?.remove();
    topicsContainer.insertAdjacentHTML('beforeend', '<div class="study-modal-topic-row"><input name="topic_name" maxlength="80" placeholder="Nome do tema"><textarea name="topic_description" rows="2" maxlength="240" placeholder="Descrição do tema"></textarea><input type="hidden" name="topic_id" value=""><button class="text-button danger-text study-modal-remove-topic" type="button" aria-label="Remover tema">Remover</button></div>');
  };
  modal.querySelectorAll('[data-study-modal-action="close"]').forEach((button) => button.addEventListener('click', closeStudySubjectModal));
  modal.querySelector('.study-modal-add-topic')?.addEventListener('click', addTopicRow);
  topicsContainer.addEventListener('click', (event) => { if (event.target.closest('.study-modal-remove-topic')) { event.target.closest('.study-modal-topic-row').remove(); if (!topicsContainer.querySelector('.study-modal-topic-row')) topicsContainer.innerHTML = '<div class="empty-panel-message study-modal-empty-topics"><strong>Nenhum tema cadastrado</strong><span>Adicione o primeiro tema desta matéria.</span></div>'; } });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const names = data.getAll('topic_name').map((name) => name.trim());
    if (names.some((name) => !name)) { showToast('Preencha o nome de todos os temas ou remova os vazios.'); return; }
    button.disabled = true;
    const topicNames = data.getAll('topic_name');
    const topicDescriptions = data.getAll('topic_description');
    const topicIds = data.getAll('topic_id');
    const topics = topicNames.map((name, index) => ({ id: topicIds[index] || `topic-${Date.now()}-${index}`, title: name.trim(), description: topicDescriptions[index]?.trim() || '', xpBase: 0, completedDates: subject.topics?.find((topic) => topic.id === topicIds[index])?.completedDates || [] }));
    try {
      const saved = await window.MyKidsData.updateStudySubject(subject.id, { childId: subject.childId, name: data.get('subject_name').trim(), description: data.get('subject_description').trim(), topics });
      const normalized = { id: saved.id, childId: saved.child_id, name: saved.name, description: saved.description || '', topics: saved.topics || [] };
      writeStudySubjects(readStudySubjects().map((item) => item.id === normalized.id ? normalized : item));
      closeStudySubjectModal();
      renderStudyPage();
      showToast('Matéria atualizada.');
    } catch (error) { button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível atualizar a matéria.')); }
  });
}

function closeStudyTopicModal() {
  document.querySelector('.study-topic-modal-backdrop')?.remove();
  if (!document.querySelector('.study-subject-modal-backdrop, .exam-edit-modal-backdrop, .activity-modal-backdrop')) document.body.classList.remove('modal-open');
}

function studyTopicModal(subject, topic) {
  return `<div class="study-topic-modal-backdrop" role="presentation"><section class="study-topic-modal" role="dialog" aria-modal="true" aria-labelledby="study-topic-modal-title"><div class="activity-modal-header"><div><p class="eyebrow">TEMA DE ESTUDO</p><h2 id="study-topic-modal-title">Editar tema</h2></div><button class="modal-close" type="button" data-study-topic-action="close" aria-label="Fechar">×</button></div><form data-study-topic-form data-subject-id="${escapeHtml(subject.id)}" data-topic-id="${escapeHtml(topic.id)}"><label>Nome do tema<input name="name" required maxlength="80" value="${escapeHtml(topic.title || '')}"></label><label>Descrição<textarea name="description" rows="5" maxlength="240">${escapeHtml(topic.description || '')}</textarea></label><div class="study-subject-modal-actions"><button class="outline-button" type="button" data-study-topic-action="close">Cancelar</button><button class="primary-button" type="submit">Salvar alterações</button></div></form></section></div>`;
}

function bindStudyTopicModal(subject, topic) {
  const modal = document.querySelector('.study-topic-modal-backdrop');
  const form = modal?.querySelector('[data-study-topic-form]');
  if (!form) return;
  bindModalFrame(modal, closeStudyTopicModal);
  modal.querySelectorAll('[data-study-topic-action="close"]').forEach((button) => button.addEventListener('click', closeStudyTopicModal));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    if (!data.get('name')?.trim()) return;
    button.disabled = true;
    try {
      const currentSubjects = readStudySubjects();
      const updatedSubject = currentSubjects.find((item) => item.id === subject.id);
      const topics = (updatedSubject?.topics || []).map((item) => item.id === topic.id ? { ...item, title: data.get('name').trim(), description: data.get('description').trim(), xpBase: 0 } : item);
      const saved = await window.MyKidsData.updateStudySubject(subject.id, { childId: subject.childId, name: subject.name, description: subject.description, topics });
      const normalized = { id: saved.id, childId: saved.child_id, name: saved.name, description: saved.description || '', topics: saved.topics || [] };
      writeStudySubjects(currentSubjects.map((item) => item.id === normalized.id ? normalized : item));
      closeStudyTopicModal();
      renderStudyPage();
      showToast('Tema atualizado.');
    } catch (error) { button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível atualizar o tema.')); }
  });
}

function closeActivityModal() {
  document.querySelector('.activity-modal-backdrop')?.remove();
  if (!document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop, .exam-edit-modal-backdrop')) document.body.classList.remove('modal-open');
}

function refreshActivityPage() {
  if (window.location.hash.slice(1) === 'responsabilidades') navigate('responsabilidades');
  else if (window.location.hash.slice(1) === 'inicio') navigate('inicio');
}

function setFormError(form, field, message) {
  const target = form.querySelector(`[data-error-for="${field}"]`);
  if (target) target.textContent = message || '';
}

function updateActivityType(form, kind) {
  form.querySelector('input[name="kind"]').value = kind;
  form.querySelectorAll('.activity-type-option').forEach((button) => button.classList.toggle('selected', button.dataset.kind === kind));
  form.querySelectorAll('.study-only').forEach((element) => element.classList.toggle('hidden', kind !== 'study'));
  form.querySelectorAll('.exam-only').forEach((element) => element.classList.toggle('hidden', kind !== 'exam'));
  form.querySelector('[name="recurrence_type"]')?.closest('label')?.classList.toggle('hidden', kind === 'exam');
  if (kind === 'exam') { setupExamStudyRows(form); setupExamGenerationFields(form); }
  const activity = form.dataset.activityId ? activities.find((item) => item.id === form.dataset.activityId) : null;
  form.querySelectorAll('.activity-reward-fields').forEach((element) => element.remove());
  const notes = form.querySelector('[name="notes"]')?.closest('label');
  if (!notes) return;
  if (kind === 'exam') {
    notes.insertAdjacentHTML('beforebegin', `<label class="activity-reward-fields">Duração (minutos)<input name="duration_minutes" type="number" min="1" max="1440" step="1" value="${escapeHtml(activity?.duration_minutes || 30)}"><span class="field-error" data-error-for="duration_minutes"></span></label><label class="activity-reward-fields">XP total<input name="xp_total" type="number" min="0" step="1" value="${escapeHtml(activity?.xp_total || 0)}"><span class="field-error" data-error-for="xp_total"></span></label><label class="activity-reward-fields">Pontos totais<input name="points_total" type="number" min="0" step="1" value="${escapeHtml(activity?.points_total || 0)}"><span class="field-error" data-error-for="points_total"></span></label>`);
  } else {
    notes.insertAdjacentHTML('beforebegin', `<label class="activity-reward-fields">XP base<input name="xp_base" type="number" min="0" step="1" value="${escapeHtml(activity?.xp_base || 0)}"><span class="field-error" data-error-for="xp_base"></span></label><label class="activity-reward-fields">Pontos base<input name="points_base" type="number" min="0" step="1" value="${escapeHtml(activity?.points_base || 0)}"><span class="field-error" data-error-for="points_base"></span></label>`);
  }
}

function updateActivityRecurrence(form) {
  const recurrence = form.querySelector('[name="recurrence_type"]');
  if (!recurrence) return;
  const type = recurrence.value;
  form.querySelector('.weekdays-field')?.classList.toggle('hidden', !['weekly', 'custom'].includes(type));
  form.querySelector('.monthly-field')?.classList.toggle('hidden', type !== 'monthly');
}

function updateActivitySubtopics(form) {
  const subject = readStudySubjects().find((entry) => entry.id === form.querySelector('[name="subject_id"]')?.value);
  const select = form.querySelector('[name="subtopic"]');
  if (!select) return;
  select.innerHTML = subject?.topics?.length ? `<option value="">Selecione uma submatéria</option>${subject.topics.map((topic) => `<option value="${escapeHtml(topic.title)}">${escapeHtml(topic.title)}</option>`).join('')}` : '<option value="">Nenhuma submatéria cadastrada</option>';
}

function examStudySummary(form, row) {
  const childId = form.querySelector('[name="child_id"]')?.value;
  const subjectId = row.querySelector('[name="exam_subject"]')?.value;
  const subject = readStudySubjects().find((item) => item.id === subjectId);
  const dates = [...row.querySelectorAll('[name="exam_study_date"]')].map((input) => input.value).filter(Boolean);
  if (!subject || !dates.length) return '';
  const themes = new Set((subject.topics || []).map((topic) => topic.title).filter(Boolean));
  activities.filter((activity) => activity.child_id === childId && activity.kind === 'study' && activity.subject === subject.name && dates.some((date) => activityIsScheduled(activity, scheduleDateFromKey(date)))).forEach((activity) => themes.add(activity.subtopic || activity.name));
  return [...themes].join(', ');
}

function prepareExamSubjectSummaries(form) {
  form.querySelectorAll('.exam-subject-row').forEach((row) => {
    const summary = row.querySelector('[name="exam_summary"]');
    if (summary) summary.value = examStudySummary(form, row);
  });
}

function bindExamStudyRow(form, row) {
  if (row.dataset.studyBound === 'true') return;
  row.dataset.studyBound = 'true';
  const dates = row.querySelector('.exam-study-date-list');
  const addDate = (value = '') => dates.insertAdjacentHTML('beforeend', `<label><input name="exam_study_date" type="date" value="${escapeHtml(value)}"><button class="text-button danger-text exam-remove-study-date" type="button">Remover</button></label>`);
  const examDate = form.querySelector('[name="exam_date"]')?.value || '';
  if (dates && !dates.querySelector('[name="exam_study_date"]')) addDate(examDate);
  row.querySelector('[name="exam_subject"]')?.addEventListener('change', () => prepareExamSubjectSummaries(form));
  row.addEventListener('change', () => prepareExamSubjectSummaries(form));
  row.querySelector('.exam-add-study-date')?.addEventListener('click', () => addDate());
  row.addEventListener('click', (event) => { if (event.target.closest('.exam-remove-study-date')) { event.target.closest('label').remove(); prepareExamSubjectSummaries(form); } });
}

function setupExamStudyRows(form) {
  const subjectLabel = form.querySelector('.exam-subject-rows')?.closest('label');
  if (subjectLabel?.firstChild) subjectLabel.firstChild.textContent = 'Matérias e dias dos temas';
  form.querySelectorAll('.exam-subject-row').forEach((row) => {
    const summary = row.querySelector('[name="exam_summary"]');
    if (summary && !row.querySelector('.exam-study-dates')) {
      summary.remove();
      row.insertAdjacentHTML('beforeend', '<input type="hidden" name="exam_summary" value=""><div class="exam-study-dates"><span class="field-label">Dias dos temas</span><div class="exam-study-date-list"></div><button class="text-button exam-add-study-date" type="button">+ Adicionar dia</button></div>');
    }
    bindExamStudyRow(form, row);
  });
  form.querySelector('[name="exam_date"]')?.addEventListener('change', () => { form.querySelectorAll('.exam-subject-row').forEach((row) => { const date = row.querySelector('[name="exam_study_date"]'); if (date && !date.value) date.value = form.querySelector('[name="exam_date"]').value; }); prepareExamSubjectSummaries(form); });
  prepareExamSubjectSummaries(form);
}

function validateActivityForm(form) {
  if (form.querySelector('[name="kind"]')?.value === 'exam') prepareExamSubjectSummaries(form);
  const data = new FormData(form);
  const kind = data.get('kind');
  const recurrenceType = data.get('recurrence_type');
  let valid = true;
  form.querySelectorAll('.field-error').forEach((element) => { element.textContent = ''; });
  if (!data.get('child_id') || !familyData.children.some((child) => child.id === data.get('child_id'))) { setFormError(form, 'name', 'Selecione uma criança válida.'); valid = false; }
  if (!data.get('name')?.trim()) { setFormError(form, 'name', 'Informe o nome da atividade.'); valid = false; }
  if (kind === 'study' && !data.get('subject_id')) { setFormError(form, 'subject_id', 'Selecione uma matéria.'); valid = false; }
  if (kind === 'study' && data.getAll('subtopic').length) {
    const subject = readStudySubjects().find((entry) => entry.id === data.get('subject_id'));
    if (!subject?.topics || data.getAll('subtopic').some((subtopic) => !subject.topics.some((topic) => topic.title === subtopic))) { setFormError(form, 'subtopic', 'Uma das submatérias não pertence à matéria escolhida.'); valid = false; }
  }
  if (kind !== 'exam' && !['daily', 'weekly', 'monthly', 'custom'].includes(recurrenceType)) { setFormError(form, 'recurrence', 'Escolha uma recorrência válida.'); valid = false; }
  const weekdays = data.getAll('weekdays').map(Number);
  if (kind !== 'exam' && ['weekly', 'custom'].includes(recurrenceType) && !weekdays.length) { setFormError(form, 'recurrence', 'Selecione ao menos um dia da semana.'); valid = false; }
  if (kind !== 'exam' && recurrenceType === 'monthly' && (!Number.isInteger(Number(data.get('day_of_month'))) || Number(data.get('day_of_month')) < 1 || Number(data.get('day_of_month')) > 31)) { setFormError(form, 'day_of_month', 'Informe um dia entre 1 e 31.'); valid = false; }
  if (data.get('duration_minutes') && (!Number.isInteger(Number(data.get('duration_minutes'))) || Number(data.get('duration_minutes')) < 1 || Number(data.get('duration_minutes')) > 1440)) { setFormError(form, 'duration_minutes', 'Use uma duração entre 1 e 1440 minutos.'); valid = false; }
  if (kind !== 'exam' && (!Number.isInteger(Number(data.get('xp_base'))) || Number(data.get('xp_base')) < 0)) { setFormError(form, 'xp_base', 'Informe um XP base igual ou maior que zero.'); valid = false; }
  if (kind !== 'exam' && (!Number.isInteger(Number(data.get('points_base'))) || Number(data.get('points_base')) < 0)) { setFormError(form, 'points_base', 'Informe pontos base iguais ou maiores que zero.'); valid = false; }
  if (kind === 'exam' && !data.get('exam_date')) { setFormError(form, 'exam_date', 'Defina a data da prova.'); valid = false; }
  if (kind === 'exam' && (!Number.isInteger(Number(data.get('xp_total'))) || Number(data.get('xp_total')) < 0)) { setFormError(form, 'xp_total', 'Informe o XP total da prova.'); valid = false; }
  if (kind === 'exam' && (!Number.isInteger(Number(data.get('points_total'))) || Number(data.get('points_total')) < 0)) { setFormError(form, 'points_total', 'Informe os Pontos totais da prova.'); valid = false; }
  if (kind === 'exam' && (!Number.isInteger(Number(data.get('duration_minutes'))) || Number(data.get('duration_minutes')) < 1 || Number(data.get('duration_minutes')) > 1440)) { setFormError(form, 'duration_minutes', 'Informe uma duração entre 1 e 1440 minutos.'); valid = false; }
  if (kind === 'exam') {
    const examSubjects = [...form.querySelectorAll('.exam-subject-row')].filter((row) => row.querySelector('[name="exam_subject"]')?.value && row.querySelector('[name="exam_summary"]')?.value.trim());
    if (!examSubjects.length) { setFormError(form, 'exam_subjects', 'Selecione uma matéria e pelo menos um dia de estudo.'); valid = false; }
  }
  return valid;
}

function generateExamQuestions(subjects, xpTotal, pointsTotal) {
  const questions = [];
  const totalWeight = 20;
  const objectiveReward = { xp: (Number(xpTotal) * 1) / totalWeight, points: (Number(pointsTotal) * 1) / totalWeight };
  const openReward = { xp: (Number(xpTotal) * 2) / totalWeight, points: (Number(pointsTotal) * 2) / totalWeight };
  for (let index = 0; index < 10; index += 1) {
    const item = subjects[index % subjects.length];
    questions.push({ type: 'multiple_choice', prompt: `Sobre ${item.subject}, qual alternativa está de acordo com este resumo: ${item.summary}`, options: ['A', 'B', 'C', 'D', 'E'], correctOption: 'A', referenceAnswer: item.summary, xp: objectiveReward.xp, points: objectiveReward.points, difficulty: 'objective' });
  }
  for (let index = 0; index < 5; index += 1) {
    const item = subjects[index % subjects.length];
    questions.push({ type: 'open', prompt: `Explique com suas palavras os principais pontos de ${item.subject} estudados neste resumo: ${item.summary}`, options: [], referenceAnswer: item.summary, xp: openReward.xp, points: openReward.points, difficulty: 'open' });
  }
  return questions;
}

let examPreviewContext = null;

function examPreviewModal(preview) {
  const questions = preview.questions || [];
  return `<div class="exam-preview-modal-backdrop" role="presentation"><section class="exam-preview-modal" role="dialog" aria-modal="true" aria-labelledby="exam-preview-title"><div class="activity-modal-header"><div><p class="eyebrow">PRÉVIA GERADA PELA IA</p><h2 id="exam-preview-title">Revise a prova antes de salvar</h2></div><button class="modal-close" type="button" data-exam-preview-action="close" aria-label="Fechar">×</button></div><div class="exam-preview-list">${questions.map((question, index) => `<article class="exam-preview-question" data-preview-index="${index}"><div class="exam-preview-question-heading"><strong>${index + 1}. ${question.type === 'multiple_choice' ? 'Objetiva' : 'Aberta'}</strong><span>${escapeHtml(question.topic)}</span></div><label>Enunciado<textarea class="exam-preview-prompt" rows="3">${escapeHtml(question.prompt)}</textarea></label>${question.type === 'multiple_choice' ? `<label>Alternativas, uma por linha<textarea class="exam-preview-options" rows="5">${escapeHtml((question.options || []).join('\n'))}</textarea></label><label>Alternativa correta<input class="exam-preview-correct" value="${escapeHtml(question.correctOption || '')}"></label>` : ''}<label>Resposta de referência<textarea class="exam-preview-reference" rows="3">${escapeHtml(question.referenceAnswer || '')}</textarea></label><div class="exam-preview-actions"><button class="text-button exam-preview-regenerate" type="button">Regenerar questão</button><button class="text-button danger-text exam-preview-delete" type="button">Excluir questão</button></div></article>`).join('')}</div><div class="study-subject-modal-actions"><button class="outline-button" type="button" data-exam-preview-action="close">Cancelar</button><button class="primary-button" type="button" data-exam-preview-action="approve">Aprovar e salvar prova</button></div></section></div>`;
}

function closeExamPreview() {
  document.querySelector('.exam-preview-modal-backdrop')?.remove();
  examPreviewContext = null;
  document.body.classList.remove('modal-open');
}

function previewQuestionFromElement(element) {
  const index = Number(element.dataset.previewIndex);
  const question = examPreviewContext.preview.questions[index];
  question.prompt = element.querySelector('.exam-preview-prompt').value.trim();
  question.referenceAnswer = element.querySelector('.exam-preview-reference').value.trim();
  if (question.type === 'multiple_choice') {
    question.options = element.querySelector('.exam-preview-options').value.split('\n').map((item) => item.trim()).filter(Boolean);
    question.correctOption = element.querySelector('.exam-preview-correct').value.trim();
  }
  return question;
}

function bindExamPreview(preview) {
  const modal = document.querySelector('.exam-preview-modal-backdrop');
  if (!modal) return;
  bindModalFrame(modal, closeExamPreview);
  modal.querySelectorAll('[data-exam-preview-action="close"]').forEach((button) => button.addEventListener('click', closeExamPreview));
  modal.querySelectorAll('.exam-preview-delete').forEach((button) => button.addEventListener('click', () => { previewQuestionFromElement(button.closest('.exam-preview-question')); button.closest('.exam-preview-question').remove(); }));
  modal.querySelectorAll('.exam-preview-regenerate').forEach((button) => button.addEventListener('click', async () => {
    const article = button.closest('.exam-preview-question');
    const question = previewQuestionFromElement(article);
    button.disabled = true;
    try {
      const regenerated = await window.MyKidsData.generateExamPreview({ ...examPreviewContext.request, objectiveCount: question.type === 'multiple_choice' ? 1 : 0, openCount: question.type === 'open' ? 1 : 0, topics: [question.topic] });
      examPreviewContext.preview.questions[Number(article.dataset.previewIndex)] = regenerated.questions[0];
      const replacement = document.createElement('div');
      replacement.innerHTML = examPreviewModal(examPreviewContext.preview);
      modal.replaceWith(replacement.firstElementChild);
      bindExamPreview(examPreviewContext.preview);
    } catch (error) { console.error('Erro ao regenerar questão da prova:', error); button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível regenerar a questão.')); }
  }));
  modal.querySelector('[data-exam-preview-action="approve"]')?.addEventListener('click', async (event) => {
    modal.querySelectorAll('.exam-preview-question').forEach(previewQuestionFromElement);
    const questions = examPreviewContext.preview.questions;
    if (!questions.length) { showToast('A prova precisa ter pelo menos uma questão.'); return; }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await window.MyKidsData.approveExam({ ...examPreviewContext.request, creationKey: examPreviewContext.creationKey, questions });
      closeExamPreview();
      await loadExams();
      refreshActivityPage();
      showToast('Prova aprovada e salva.');
    } catch (error) { console.error('Erro ao aprovar prova:', error); button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível salvar a prova.')); }
  });
}

function openExamPreview(preview, request) {
  examPreviewContext = { preview, request, creationKey: crypto.randomUUID() };
  document.body.insertAdjacentHTML('beforeend', examPreviewModal(preview));
  bindExamPreview(preview);
}

function bindActivityModal() {
  const modal = document.querySelector('.activity-modal-backdrop');
  const form = modal?.querySelector('[data-activity-form]');
  if (!form) return;
  if (form.querySelector('[name="kind"]')?.value === 'exam') form.querySelector('[name="recurrence_type"]')?.closest('label')?.remove();
  form.querySelector('[name="exam_date"]')?.removeAttribute('required');
  if (!form.querySelector('.weekdays-field')) {
    const activity = form.dataset.activityId ? activities.find((item) => item.id === form.dataset.activityId) : null;
    const selectedDays = activity?.recurrence?.weekdays || [];
    const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const weekdaysField = document.createElement('div');
    weekdaysField.className = 'weekdays-field hidden';
    weekdaysField.innerHTML = `<span class="field-label">Dias da semana</span><div class="weekday-options">${weekdays.map((day, index) => `<label><input type="checkbox" name="weekdays" value="${index}"${selectedDays.includes(index) ? ' checked' : ''}><span>${day}</span></label>`).join('')}</div><span class="field-error" data-error-for="weekdays"></span>`;
    form.querySelector('[name="start_time"]')?.closest('label')?.before(weekdaysField);
  }
  form.querySelectorAll('.activity-type-option').forEach((button) => button.addEventListener('click', () => updateActivityType(form, button.dataset.kind)));
  form.querySelector('[name="recurrence_type"]')?.addEventListener('change', () => updateActivityRecurrence(form));
  const subtopicSelect = form.querySelector('[name="subtopic"]');
  if (subtopicSelect) { subtopicSelect.multiple = true; subtopicSelect.size = 3; subtopicSelect.closest('label').firstChild.textContent = 'Submatérias'; }
  form.querySelector('[name="subject_id"]')?.addEventListener('change', () => updateActivitySubtopics(form));
  form.querySelector('.add-exam-subject')?.addEventListener('click', () => { const row = form.querySelector('.exam-subject-row')?.cloneNode(true); if (!row) return; row.dataset.studyBound = ''; row.querySelector('[name="exam_subject"]').value = ''; row.querySelector('[name="exam_summary"]').value = ''; row.querySelector('.exam-study-date-list').innerHTML = ''; form.querySelector('.exam-subject-rows').appendChild(row); bindExamStudyRow(form, row); });
  modal.querySelectorAll('[data-activity-action="close"]').forEach((button) => button.addEventListener('click', closeActivityModal));
  updateActivityType(form, form.querySelector('[name="kind"]').value);
  if (form.querySelector('[name="kind"]')?.value === 'exam') { setupExamStudyRows(form); setupExamGenerationFields(form); }
  updateActivityRecurrence(form);
  updateActivitySubtopics(form);
  const currentSubtopic = form.dataset.activityId ? activities.find((item) => item.id === form.dataset.activityId)?.subtopic : '';
  if (currentSubtopic && subtopicSelect) {
    const selectedSubtopics = currentSubtopic.split(',').map((item) => item.trim()).filter(Boolean);
    [...subtopicSelect.options].forEach((option) => { option.selected = selectedSubtopics.includes(option.value); });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateActivityForm(form)) return;
    const button = form.querySelector('.activity-save-button');
    button.disabled = true;
    button.textContent = 'Salvando...';
    const data = new FormData(form);
    const subject = readStudySubjects().find((entry) => entry.id === data.get('subject_id'));
      if (data.get('kind') === 'exam') {
        const subjects = [...form.querySelectorAll('.exam-subject-row')].map((row) => {
          const subjectId = row.querySelector('[name="exam_subject"]')?.value;
          const subjectRecord = readStudySubjects().find((item) => item.id === subjectId);
          return { subjectId, subject: subjectRecord?.name || '', summary: row.querySelector('[name="exam_summary"]')?.value.trim() || '' };
        }).filter((item) => item.subjectId && item.summary);
        const themes = [...new Set(subjects.flatMap((item) => item.summary.split(',').map((theme) => theme.trim()).filter(Boolean)))];
        const request = { childId: data.get('child_id'), subjectId: subjects[0]?.subjectId, topics: themes, examDate: data.get('exam_date'), objectiveCount: Number(data.get('objective_count')), openCount: Number(data.get('open_count')), difficulty: data.get('difficulty') };
        if (!request.subjectId || !themes.length) { showToast('Selecione a matéria e pelo menos um dia com temas de estudo.'); button.disabled = false; button.textContent = 'Criar prova'; return; }
        try { const preview = await window.MyKidsData.generateExamPreview(request); closeActivityModal(); openExamPreview(preview, { ...request, scheduledDate: request.examDate, name: data.get('name').trim(), startTime: data.get('start_time'), durationMinutes: Number(data.get('duration_minutes')), subjects: subjects.map(({ subjectId, subject, summary }) => ({ subject, subjectId, summary })), xpTotal: Number(data.get('xp_total')), pointsTotal: Number(data.get('points_total')) }); } catch (error) { console.error('Erro ao gerar prévia da prova:', error); showToast(resolveErrorMessage(error, 'Não foi possível gerar a prévia.')); button.disabled = false; button.textContent = 'Criar prova'; } return;
      }
      const payload = { family_id: familyData.family.id, child_id: data.get('child_id'), kind: data.get('kind'), name: data.get('name').trim(), subject: subject?.name || null, subtopic: data.getAll('subtopic').filter(Boolean).join(', ') || null, recurrence: { type: data.get('recurrence_type'), weekdays: data.getAll('weekdays').map(Number), day_of_month: data.get('day_of_month') ? Number(data.get('day_of_month')) : null }, start_time: data.get('start_time') || null, duration_minutes: data.get('duration_minutes') ? Number(data.get('duration_minutes')) : null, notes: data.get('notes')?.trim() || null, xp_base: Number(data.get('xp_base')), points_base: Number(data.get('points_base')) };
    try {
      if (form.dataset.activityId) await window.MyKidsData.updateActivity(form.dataset.activityId, payload);
      else await window.MyKidsData.createActivity(payload);
      await loadActivities();
      closeActivityModal();
      refreshActivityPage();
      showToast(form.dataset.activityId ? 'Atividade atualizada.' : 'Atividade criada.');
    } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível salvar a atividade.')); button.disabled = false; button.textContent = 'Salvar atividade'; }
  });
}

function setupExamGenerationFields(form) {
  if (form.querySelector('.exam-ai-fields')) return;
  const notes = form.querySelector('[name="notes"]')?.closest('label');
  if (!notes) return;
  notes.insertAdjacentHTML('beforebegin', '<div class="exam-ai-fields"><label>Questões objetivas<input name="objective_count" type="number" min="0" max="30" value="10"></label><label>Questões abertas<input name="open_count" type="number" min="0" max="10" value="5"></label><label>Dificuldade<select name="difficulty"><option value="easy">Fácil</option><option value="medium" selected>Média</option><option value="hard">Difícil</option></select></label></div>');
}

function openActivityModal(activity = null) {
  if (document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop, .exam-edit-modal-backdrop, .activity-modal-backdrop')) return;
  document.body.insertAdjacentHTML('beforeend', activityModal(activity || {}));
  bindActivityModal();
}

function updateLocalActivityOccurrence(activityId, date, status) {
  const activity = activities.find((entry) => entry.id === activityId);
  if (!activity) return null;
  const occurrences = activity.occurrences || [];
  const current = occurrences.find((occurrence) => occurrence.occurrence_date === date);
  const previousStatus = current?.status || 'pending';
  if (current) current.status = status;
  else occurrences.push({ activity_id: activityId, occurrence_date: date, status });
  activity.occurrences = occurrences;
  return previousStatus;
}

async function toggleActivityOccurrence(button, rerender) {
  if (button.dataset.pending === 'true') return;
  const activity = activities.find((entry) => entry.id === button.dataset.activityId);
  if (!activity) return;
  const today = scheduleDateKey(selectedScheduleDate);
  const completed = activity.occurrences?.some((occurrence) => occurrence.occurrence_date === today && occurrence.status === 'completed');
  const nextStatus = completed ? 'pending' : 'completed';
  const previousStatus = updateLocalActivityOccurrence(activity.id, today, nextStatus);
  const progressionChange = nextStatus === 'completed'
    ? awardProgression(activity.child_id, activity.name, activity.xp_base, activity.points_base, activity.kind === 'study' ? 'study' : 'repetitive', activity.id, today, 'Atividade concluída')
    : reverseProgression(activity.child_id, activity.id, today);
  button.dataset.pending = 'true';
  button.disabled = true;
  button.classList.toggle('checked', nextStatus === 'completed');
  button.setAttribute('aria-pressed', String(nextStatus === 'completed'));
  button.textContent = nextStatus === 'completed' ? '✓' : '';
  rerender();
  try {
    await window.MyKidsData.saveActivityOccurrence({ activityId: activity.id, childId: button.dataset.childId, date: today, status: nextStatus });
    showToast(nextStatus === 'completed' ? 'Atividade concluída.' : 'Atividade reaberta.');
  } catch (error) {
    updateLocalActivityOccurrence(activity.id, today, previousStatus);
    if (nextStatus === 'completed' && progressionChange.awarded) reverseProgression(activity.child_id, activity.id, today);
    if (nextStatus === 'pending' && progressionChange) awardProgression(activity.child_id, activity.name, activity.xp_base, activity.points_base, activity.kind === 'study' ? 'study' : 'repetitive', activity.id, today, 'Atividade concluída');
    rerender();
    showToast(resolveErrorMessage(error, 'Não foi possível atualizar a atividade.'));
  } finally {
    button.dataset.pending = 'false';
    button.disabled = false;
  }
}

function bindActivityPage() {
  document.querySelector('[data-activity-action="add"]')?.addEventListener('click', () => openActivityModal());
  bindScheduleNavigation(() => navigate('responsabilidades'));
  document.querySelectorAll('[data-exam-action="edit"]').forEach((button) => button.addEventListener('click', () => {
    const exam = exams.find((item) => item.id === button.dataset.examId);
    if (exam) openExamEditModal(exam);
  }));
  document.querySelectorAll('[data-exam-action="delete"]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Excluir esta prova?')) return;
    const exam = exams.find((item) => item.id === button.dataset.examId);
    try {
      await window.MyKidsData.deleteExam(button.dataset.examId);
      if (exam) reverseExamProgression(exam);
      await loadExams();
      refreshActivityPage();
      showToast('Prova excluída.');
    } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível excluir a prova.')); }
  }));
  document.querySelectorAll('[data-activity-action="edit"]').forEach((button) => button.addEventListener('click', () => openActivityModal(activities.find((activity) => activity.id === button.dataset.activityId))));
  document.querySelectorAll('[data-activity-action="delete"]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Excluir esta atividade?')) return;
    try { await window.MyKidsData.deleteActivity(button.dataset.activityId); await loadActivities(); refreshActivityPage(); showToast('Atividade excluída.'); } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível excluir a atividade.')); }
  }));
  document.querySelectorAll('[data-activity-action="toggle"]').forEach((button) => button.addEventListener('click', () => toggleActivityOccurrence(button, () => refreshActivityPage())));
}

function bindOverviewActivities() {
  document.querySelectorAll('.timeline [data-activity-action="toggle"]').forEach((button) => button.addEventListener('click', () => toggleActivityOccurrence(button, refreshOverviewSchedule)));
}

function refreshOverviewSchedule() {
  renderOverviewActivities();
  renderOverviewProgress();
  bindOverviewActivities();
  bindScheduleNavigation(refreshOverviewSchedule);
}

function bindChildPicker() {
  if (document.body.dataset.childPickerBound) return;
  document.body.dataset.childPickerBound = 'true';
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.child-picker-trigger');
    const option = event.target.closest('.child-picker-option');
    if (trigger) {
      const picker = trigger.closest('.child-picker');
      const menu = picker.querySelector('.child-picker-menu');
      const isOpen = picker.classList.toggle('open');
      menu.hidden = !isOpen;
      trigger.setAttribute('aria-expanded', String(isOpen));
      return;
    }
    if (option) {
      const picker = option.closest('.child-picker');
      const page = picker.dataset.childPicker;
      managedPageSelection[page] = option.dataset.childId;
      picker.classList.remove('open');
      if (page === 'estudos') renderStudyPage();
      else renderManagedPage(page);
      return;
    }
    document.querySelectorAll('.child-picker.open').forEach((picker) => {
      picker.classList.remove('open');
      picker.querySelector('.child-picker-menu').hidden = true;
      picker.querySelector('.child-picker-trigger').setAttribute('aria-expanded', 'false');
    });
  });
}

function bindStudyPage() {
  const childSelect = document.querySelector('.study-child-select');
  childSelect?.addEventListener('change', () => { managedPageSelection.estudos = childSelect.value; renderStudyPage(); });
  document.querySelector('.study-replicate-button')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const sourceId = currentChildId('estudos');
    const targetId = document.querySelector('.study-replication-target')?.value;
    const targetName = familyData.children.find((child) => child.id === targetId)?.name || 'a criança selecionada';
    const sourceSubjects = readStudySubjects().filter((subject) => subject.childId === sourceId);
    const targetSubjects = readStudySubjects().filter((subject) => subject.childId === targetId);
    const targetNames = new Set(targetSubjects.map((subject) => subject.name.trim().toLocaleLowerCase('pt-BR')));
    const subjectsToCopy = sourceSubjects.filter((subject) => !targetNames.has(subject.name.trim().toLocaleLowerCase('pt-BR')));
    if (!subjectsToCopy.length) { showToast(`${targetName} já possui todas essas matérias.`); return; }
    button.disabled = true;
    try {
      for (const subject of subjectsToCopy) {
        const topics = (subject.topics || []).map((topic, index) => ({ ...topic, id: `topic-${Date.now()}-${index}`, completedDates: [] }));
        const saved = await window.MyKidsData.createStudySubject({ familyId: familyData.family.id, childId: targetId, name: subject.name, description: subject.description, topics });
        targetSubjects.push({ id: saved.id, childId: saved.child_id, name: saved.name, description: saved.description || '', topics: saved.topics || [] });
      }
      writeStudySubjects([...readStudySubjects().filter((subject) => subject.childId !== targetId), ...targetSubjects]);
      renderStudyPage();
      showToast(`${subjectsToCopy.length} matéria(s) replicada(s) para ${targetName}.`);
    } catch (error) { button.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível replicar as matérias.')); }
  });
  document.querySelector('.study-add-subject')?.addEventListener('click', () => {
    document.querySelector('#study-form-host').innerHTML = studyForm('subject');
    bindStudyPage();
    document.querySelector('[data-study-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelectorAll('[data-study-action="add-topic"]').forEach((button) => button.addEventListener('click', () => {
    const subject = readStudySubjects().find((entry) => entry.id === button.dataset.subjectId);
    document.querySelector('#study-form-host').innerHTML = studyForm('topic', subject);
    bindStudyPage();
    document.querySelector('[data-study-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.querySelectorAll('[data-study-action="edit-subject"]').forEach((button) => button.addEventListener('click', () => {
    if (document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop')) return;
    const subject = readStudySubjects().find((entry) => entry.id === button.dataset.subjectId);
    if (!subject) return;
    document.body.insertAdjacentHTML('beforeend', studySubjectModal(subject));
    bindStudySubjectModal(subject);
  }));
  document.querySelectorAll('[data-study-action="edit-topic"]').forEach((button) => button.addEventListener('click', () => {
    const subject = readStudySubjects().find((entry) => entry.id === button.dataset.subjectId);
    const topic = subject?.topics?.find((entry) => entry.id === button.dataset.topicId);
    if (!subject || !topic || document.querySelector('.study-subject-modal-backdrop, .study-topic-modal-backdrop')) return;
    document.body.insertAdjacentHTML('beforeend', studyTopicModal(subject, topic));
    bindStudyTopicModal(subject, topic);
  }));
  document.querySelectorAll('[data-study-action="delete-subject"]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('Excluir esta matéria e seus temas?')) return;
    try {
      await window.MyKidsData.deleteStudySubject(button.dataset.subjectId);
      writeStudySubjects(readStudySubjects().filter((subject) => subject.id !== button.dataset.subjectId));
      renderStudyPage();
      showToast('Matéria excluída.');
    } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível excluir a matéria.')); }
  }));
  document.querySelectorAll('[data-study-action="delete-topic"]').forEach((button) => button.addEventListener('click', () => {
    if (!window.confirm('Excluir este tema de estudo?')) return;
    const subjects = readStudySubjects().map((subject) => subject.id === button.dataset.subjectId ? { ...subject, topics: (subject.topics || []).filter((topic) => topic.id !== button.dataset.topicId) } : subject);
    writeStudySubjects(subjects);
    renderStudyPage();
    showToast('Tema excluído.');
  }));
  document.querySelectorAll('[data-study-action="complete-topic"]').forEach((button) => button.addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const subjects = readStudySubjects();
    const subject = subjects.find((entry) => entry.id === button.dataset.subjectId);
    const topic = subject?.topics?.find((entry) => entry.id === button.dataset.topicId);
    if (!topic || topic.completedDates?.includes(today)) return;
    const result = awardProgression(topic.childId || subject.childId, topic.title, topic.xpBase, 0, 'study', topic.id, today, 'Tema de estudo concluído');
    const updated = subjects.map((entry) => entry.id === subject.id ? { ...entry, topics: entry.topics.map((item) => item.id === topic.id ? { ...item, completedDates: [...(item.completedDates || []), today] } : item) } : entry);
    writeStudySubjects(updated);
    renderStudyPage();
    showToast(result.levelUp ? `Parabéns! Você alcançou o nível ${result.newLevel}.` : `+${result.xpGained} XP de estudo.`);
  }));
  document.querySelector('[data-study-action="cancel"]')?.addEventListener('click', () => { document.querySelector('#study-form-host').innerHTML = ''; });
  document.querySelector('[data-study-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const formData = new FormData(form);
    const subjects = readStudySubjects();
    const isTopic = form.dataset.studyForm === 'topic';
    const name = formData.get('name').trim();
    const description = formData.get('description').trim();
    try {
    if (isTopic) {
      const updated = subjects.map((subject) => {
        if (subject.id !== form.dataset.subjectId) return subject;
        const topics = subject.topics || [];
        const topic = { id: form.dataset.topicId || `topic-${Date.now()}`, title: name, description, xpBase: 0, completedDates: topics.find((entry) => entry.id === form.dataset.topicId)?.completedDates || [] };
        return { ...subject, topics: form.dataset.topicId ? topics.map((entry) => entry.id === topic.id ? topic : entry) : [...topics, topic] };
      });
      const updatedSubject = updated.find((subject) => subject.id === form.dataset.subjectId);
      await window.MyKidsData.updateStudySubject(updatedSubject.id, { childId: updatedSubject.childId, name: updatedSubject.name, description: updatedSubject.description, topics: updatedSubject.topics });
      writeStudySubjects(updated);
    } else {
      const childId = currentChildId('estudos');
      if (!familyData.children?.some((child) => child.id === childId)) { showToast('Cadastre uma criança antes de salvar esta matéria.'); return; }
      const subject = { id: form.dataset.subjectId, childId, name, description, topics: subjects.find((entry) => entry.id === form.dataset.subjectId)?.topics || [] };
      const saved = form.dataset.subjectId
        ? await window.MyKidsData.updateStudySubject(subject.id, subject)
        : await window.MyKidsData.createStudySubject({ familyId: familyData.family.id, ...subject });
      const normalized = { id: saved.id, childId: saved.child_id, name: saved.name, description: saved.description || '', topics: saved.topics || [] };
      writeStudySubjects(form.dataset.subjectId ? subjects.map((entry) => entry.id === normalized.id ? normalized : entry) : [...subjects, normalized]);
    }
    renderStudyPage();
    showToast(isTopic ? 'Tema salvo.' : 'Matéria salva.');
    } catch (error) { submitButton.disabled = false; showToast(resolveErrorMessage(error, 'Não foi possível salvar a matéria.')); }
  });
}

function managedForm(page, item = {}) {
  const isRoutine = page === 'rotina';
  const title = isRoutine ? 'Adicionar rotina' : 'Adicionar responsabilidade';
  const frequencyOptions = isRoutine ? ['Diária', 'Dias úteis', 'Semanal'] : ['Diária', 'Semanal', 'Anual'];
  const options = frequencyOptions.map((option) => `<option${item.frequency === option ? ' selected' : ''}>${option}</option>`).join('');
  return `<form class="managed-form" data-managed-form="${page}" data-item-id="${escapeHtml(item.id || '')}"><div class="managed-form-heading"><div><p class="eyebrow">${item.id ? 'EDITAR' : 'NOVO CADASTRO'}</p><h2>${item.id ? 'Editar' : title}</h2></div><button type="button" class="text-button" data-managed-action="cancel">Cancelar</button></div><div class="managed-form-grid"><label>Nome<input name="title" required maxlength="80" value="${escapeHtml(item.title || '')}" placeholder="Ex.: Guardar material escolar"></label><label>${isRoutine ? 'Horário do lembrete' : 'Recorrência'}${isRoutine ? `<input name="time" type="time" value="${escapeHtml(item.time || '')}">` : `<select name="frequency">${options}</select>`}</label>${isRoutine ? `<label>Frequência<select name="frequency">${options}</select></label>` : `<label>XP base<input name="xpBase" type="number" min="0" step="1" required value="${escapeHtml(item.xpBase || '')}" placeholder="XP cadastrado"></label><label>Pontos<input name="pointsBase" type="number" min="0" step="1" required value="${escapeHtml(item.pointsBase || '')}" placeholder="Pontos cadastrados"></label>`}<label class="full-field">Observações<textarea name="description" rows="3" maxlength="240" placeholder="Detalhes opcionais">${escapeHtml(item.description || '')}</textarea></label></div><div class="managed-form-actions"><button class="primary-button" type="submit">Salvar</button></div></form>`;
}

function renderManagedPage(page) {
  appView.innerHTML = page === 'rotina' ? routinePage() : responsibilityPage();
  bindManagedPage(page);
}

function bindManagedPage(page) {
  const type = page === 'rotina' ? 'routines' : 'responsibilities';
  const childSelect = document.querySelector('.managed-child-select');
  childSelect?.addEventListener('change', () => { managedPageSelection[page] = childSelect.value; renderManagedPage(page); });
  document.querySelector('.managed-add-button')?.addEventListener('click', () => {
    document.querySelector('#managed-form-host').innerHTML = managedForm(page);
    bindManagedPage(page);
    document.querySelector('.managed-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelectorAll('[data-managed-action="edit"]').forEach((button) => button.addEventListener('click', () => {
    const item = readManagedItems(type).find((entry) => entry.id === button.dataset.itemId);
    document.querySelector('#managed-form-host').innerHTML = managedForm(page, item);
    bindManagedPage(page);
    document.querySelector('.managed-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.querySelectorAll('[data-managed-action="delete"]').forEach((button) => button.addEventListener('click', () => {
    if (!window.confirm('Excluir este cadastro?')) return;
    writeManagedItems(type, readManagedItems(type).filter((item) => item.id !== button.dataset.itemId));
    renderManagedPage(page);
    showToast('Cadastro excluído.');
  }));
  document.querySelectorAll('[data-managed-action="toggle"]').forEach((button) => button.addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const items = readManagedItems(type).map((item) => {
      if (item.id !== button.dataset.itemId) return item;
      const completedDates = item.completedDates || [];
      if (completedDates.includes(today)) return { ...item, completedDates: completedDates.filter((date) => date !== today) };
      const result = awardProgression(item.childId, item.title, item.xpBase, item.pointsBase, 'repetitive', item.id, today, 'Responsabilidade concluída');
      if (result.awarded && result.levelUp) showToast(`Parabéns! Você alcançou o nível ${result.newLevel}.`);
      return { ...item, completedDates: [...completedDates, today] };
    });
    writeManagedItems(type, items);
    renderManagedPage(page);
  }));
  document.querySelector('[data-managed-action="cancel"]')?.addEventListener('click', () => { document.querySelector('#managed-form-host').innerHTML = ''; });
  document.querySelector('.managed-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const items = readManagedItems(type);
    const existing = items.find((item) => item.id === form.dataset.itemId);
    const childId = currentChildId(page);
    if (!familyData.children?.some((child) => child.id === childId)) { showToast('Cadastre uma criança antes de salvar esta atividade.'); return; }
    const item = { id: form.dataset.itemId || `item-${Date.now()}`, childId, title: formData.get('title').trim(), description: formData.get('description').trim(), frequency: formData.get('frequency'), time: formData.get('time') || '', xpBase: Number(formData.get('xpBase')) || 0, pointsBase: Number(formData.get('pointsBase')) || 0, completedDates: existing?.completedDates || [] };
    writeManagedItems(type, form.dataset.itemId ? items.map((entry) => entry.id === item.id ? item : entry) : [...items, item]);
    renderManagedPage(page);
    showToast(existing ? 'Cadastro atualizado.' : 'Cadastro adicionado.');
  });
}

function findSearchTarget(term) {
  const normalizedTerm = term.toLocaleLowerCase('pt-BR');
  return Object.entries(pageMeta).find(([page, [title, description]]) => page !== 'login' && page !== 'onboarding'
    && `${title} ${description}`.toLocaleLowerCase('pt-BR').includes(normalizedTerm))?.[0];
}

function highlightSearchTerm(term) {
  const walker = document.createTreeWalker(document.querySelector('#app-view'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script, style, input, textarea')) continue;
    if (node.textContent.toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR'))) {
      node.parentElement.classList.add('search-match');
      node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => node.parentElement.classList.remove('search-match'), 2200);
      return true;
    }
  }
  return false;
}

function bindSearch() {
  const form = document.querySelector('#searchForm');
  const input = document.querySelector('#searchInput');
  if (!form || !input || form.dataset.bound) return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const term = input.value.trim();
    if (!term) return;
    const target = findSearchTarget(term);
    if (target && target !== window.location.hash.slice(1)) {
      history.pushState({ page: target }, '', `#${target}`);
      navigate(target);
    }
    setTimeout(() => {
      showToast(highlightSearchTerm(term) ? `Termo encontrado: ${term}` : `Nenhum resultado para "${term}".`);
    }, target && target !== window.location.hash.slice(1) ? 0 : 0);
  });
}

const childLoginPage = () => '<div class="auth-screen"><div class="auth-brand"><span class="brand-mark">M</span><strong>my<span>kids</span></strong></div><div class="auth-card child-login-card"><p class="eyebrow">ACESSO INFANTIL</p><h1>Vamos para a aventura!</h1><p class="auth-subtitle">Use o e-mail e a senha cadastrados pelo responsável da família.</p><label>E-mail infantil<input class="child-login-email" type="email" placeholder="helenadesouza@mykids.com.br" autocomplete="username"></label><label>Senha<div class="password-field"><input class="child-login-password" type="password" placeholder="@Helena10" autocomplete="current-password"><button type="button" class="password-toggle" data-toggle-password aria-label="Mostrar senha">Mostrar</button></div></label><button class="primary-button auth-submit auth-child-login-button" data-auth="child-login">Entrar no painel da criança</button><div class="auth-footer"><button class="text-button route-button" data-page="login">Voltar ao responsável</button></div></div></div>';

const pages = {
  login: () => '<div class="auth-screen"><div class="auth-brand"><span class="brand-mark">M</span><strong>my<span>kids</span></strong></div><div class="auth-card"><p class="eyebrow">BEM-VINDO DE VOLTA</p><h1>Continue cuidando da rotina.</h1><p class="auth-subtitle">Entre para acompanhar cada pequeno avanço da sua família.</p><label>E-mail<input class="auth-email" type="email" placeholder="voce@email.com" autocomplete="email"></label><label>Senha<div class="password-field"><input class="auth-password" type="password" placeholder="Digite sua senha" autocomplete="current-password"><button type="button" class="password-toggle" data-toggle-password aria-label="Mostrar senha">Mostrar</button></div></label><button class="primary-button auth-submit auth-login-button" data-auth="login">Entrar na minha conta</button><div class="auth-footer">Ainda não tem conta? <button class="text-button route-button" data-page="onboarding">Criar família grátis</button></div><div class="auth-footer"><button class="text-button route-button" data-page="child-login">Entrar como criança</button></div></div></div>',
  'child-login': childLoginPage,
  childLogin: childLoginPage,
  onboarding: () => '<div class="auth-screen"><div class="auth-brand"><span class="brand-mark">M</span><strong>my<span>kids</span></strong></div><div class="onboarding-card"><p class="eyebrow">VAMOS COMEÇAR</p><h1>Conte um pouco sobre sua família.</h1><p class="auth-subtitle">Vamos personalizar o MyKids para a rotina de vocês.</p><div class="form-grid"><label>Seu nome<input class="signup-name" placeholder="Seu nome" autocomplete="name"></label><label>Nome da família<input class="signup-family" placeholder="Nome da família"></label><label>Nome da criança<input class="signup-child" placeholder="Nome da criança"></label><label>Idade<input class="signup-age" type="number" placeholder="Idade"></label><label class="full-field">E-mail<input class="signup-email" type="email" placeholder="voce@email.com" autocomplete="email"></label><label class="full-field">Senha<div class="password-field"><input class="signup-password" type="password" placeholder="Mínimo de 6 caracteres" autocomplete="new-password"><button type="button" class="password-toggle" data-toggle-password aria-label="Mostrar senha">Mostrar</button></div></label></div><button class="primary-button auth-submit auth-signup-button" data-auth="signup">Criar minha família</button></div></div>',
  estudos: studyPage,
  responsabilidades: responsibilityPage,
  relatorios: () => emptyPage('Relatórios'),
  tempo: () => emptyPage('Tracker de tempo'),
  crianca: childPage,
  perfil: childProfilePage,
  loja: childStorePage,
  configuracoes: settingsPage
};

async function logout() {
  try { await window.MyKidsData?.signOut(); } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível sair agora.')); return; }
  currentChildSession = null;
  authenticated = false;
  history.pushState({ page: 'login' }, '', '#login');
  navigate('login');
}

function normalizeChildPassword(value) {
  return String(value || '').trim().toLowerCase();
}

function legacyHashChildSecret(value) {
  return String(value || '').trim().split('').reduce((total, char) => total + char.charCodeAt(0), 0).toString(36);
}

function hashChildSecret(value) {
  return normalizeChildPassword(value).split('').reduce((total, char) => total + char.charCodeAt(0), 0).toString(36);
}

function buildChildAccessEntry({ childId, childName, childAge, email, password, familyId }) {
  const typedPassword = String(password || '').trim();
  const normalizedPassword = normalizeChildPassword(typedPassword);
  return {
    childId,
    childName,
    childAge,
    email: String(email || '').trim().toLowerCase(),
    password: typedPassword,
    familyId: familyId || 'local',
    passwordHash: typedPassword ? hashChildSecret(normalizedPassword) : ''
  };
}

function readChildAccessList() {
  const familyId = familyData.family?.id || 'local';
  const entries = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith('mykids-child-access-')) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(parsed)) entries.push(...parsed);
    } catch (error) {
      console.warn('Não foi possível carregar o acesso infantil salvo.', error);
    }
  }
  if (familyId && !entries.some((entry) => entry.familyId === familyId)) {
    try {
      const currentFamilyEntries = JSON.parse(localStorage.getItem(`mykids-child-access-${familyId}`) || '[]');
      if (Array.isArray(currentFamilyEntries)) entries.push(...currentFamilyEntries);
    } catch (error) {
      console.warn('Não foi possível ler o acesso infantil da família atual.', error);
    }
  }
  return entries;
}

function writeChildAccessList(entries) {
  const familyId = familyData.family?.id || 'local';
  const normalizedEntries = (entries || []).map((entry) => buildChildAccessEntry({
    childId: entry.childId,
    childName: entry.childName,
    childAge: entry.childAge,
    email: entry.email,
    password: entry.password,
    familyId: entry.familyId || familyId
  }));

  const familyEntries = normalizedEntries.filter((entry) => entry.familyId === familyId);
  const localEntries = normalizedEntries.filter((entry) => entry.familyId === 'local' || !entry.familyId);

  localStorage.setItem(`mykids-child-access-${familyId}`, JSON.stringify(familyEntries));
  localStorage.setItem('mykids-child-access-local', JSON.stringify(localEntries));
}

function resolveChildAccess(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const typedPassword = String(password || '').trim();
  const normalizedPassword = normalizeChildPassword(typedPassword);
  const passwordVariants = new Set([
    typedPassword,
    normalizedPassword,
    String(typedPassword || '').toUpperCase(),
    String(normalizedPassword || '').toUpperCase(),
    hashChildSecret(typedPassword),
    hashChildSecret(normalizedPassword),
    legacyHashChildSecret(typedPassword),
    legacyHashChildSecret(normalizedPassword),
    legacyHashChildSecret(String(typedPassword || '').toUpperCase())
  ]);

  const list = readChildAccessList();
  const match = list.find((entry) => {
    const entryEmail = String(entry.email || '').trim().toLowerCase();
    if (entryEmail !== normalizedEmail) return false;

    const entryPassword = String(entry.password || '').trim();
    const entryPasswordNormalized = normalizeChildPassword(entryPassword);
    const entryHash = String(entry.passwordHash || '').trim();
    const plainMatches = !!entryPassword && (
      entryPassword === typedPassword ||
      entryPasswordNormalized === normalizedPassword ||
      entryPassword === normalizedPassword ||
      entryPasswordNormalized === typedPassword
    );
    const hashMatches = !!entryHash && passwordVariants.has(entryHash);
    const storedLegacyMatches = !!entryPassword && passwordVariants.has(hashChildSecret(entryPassword))
      || !!entryPassword && passwordVariants.has(legacyHashChildSecret(entryPassword));

    return plainMatches || hashMatches || storedLegacyMatches;
  });

  if (!match) return null;
  const matchedChild = familyData.children?.find((child) => child.id === match.childId) || {
    id: match.childId,
    name: match.childName || 'Criança',
    age: match.childAge || null,
    email: match.email
  };
  return matchedChild;
}

function bindAuthActions() {
  document.querySelectorAll('[data-auth="login"]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await window.MyKidsData.signIn(document.querySelector('.auth-email')?.value.trim(), document.querySelector('.auth-password')?.value);
      authenticated = true;
      currentChildSession = null;
      await loadFamilyData();
      await loadActivities();
      await loadExams();
      await loadStudySubjects();
      navigate('inicio');
    } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível entrar.')); button.disabled = false; }
  }));

  document.querySelectorAll('[data-auth="child-login"]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const email = document.querySelector('.child-login-email')?.value.trim();
      const password = document.querySelector('.child-login-password')?.value;
      const child = resolveChildAccess(email, password);
      if (!child) throw new Error('E-mail ou senha da criança inválidos.');
      currentChildSession = { childId: child.id, email, childName: child.name, age: child.age };
      authenticated = true;
      await loadFamilyData();
      await loadActivities();
      await loadExams();
      await loadStudySubjects();
      navigate('crianca');
    } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível entrar no painel infantil.')); button.disabled = false; }
  }));

  document.querySelectorAll('[data-auth="signup"]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    const payload = { email: document.querySelector('.signup-email')?.value.trim(), password: document.querySelector('.signup-password')?.value, name: document.querySelector('.signup-name')?.value.trim(), familyName: document.querySelector('.signup-family')?.value.trim(), children: [{ name: document.querySelector('.signup-child')?.value.trim(), age: document.querySelector('.signup-age')?.value }].filter((child) => child.name), objectives: [] };
    try { const result = await window.MyKidsData.signUp(payload); authenticated = Boolean(result?.session); currentChildSession = null; if (authenticated) { await loadFamilyData(); await loadActivities(); await loadExams(); await loadStudySubjects(); } navigate(authenticated ? 'inicio' : 'login'); } catch (error) { showToast(resolveErrorMessage(error, 'Não foi possível criar a família.')); button.disabled = false; }
  }));
}

function bindPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    if (button.dataset.boundToggle === 'true') return;
    button.dataset.boundToggle = 'true';
    button.addEventListener('click', () => {
      const field = button.closest('.password-field')?.querySelector('input');
      if (!field) return;
      const shouldShow = field.type === 'password';
      field.type = shouldShow ? 'text' : 'password';
      button.textContent = shouldShow ? 'Ocultar' : 'Mostrar';
      button.setAttribute('aria-label', shouldShow ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
}

function bindSettingsPage() {
  const form = document.querySelector('[data-child-access-form]');
  if (!form) return;
  bindPasswordToggles();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rows = [...form.querySelectorAll('.child-access-row')].map((row) => {
      const childId = row.dataset.childId;
      const child = (familyData.children || []).find((entry) => entry.id === childId);
      const email = row.querySelector('[name="child-email"]')?.value.trim().toLowerCase();
      const password = String(row.querySelector('[name="child-password"]')?.value || '').trim();
      if (!childId || !email || !password) return null;
      return buildChildAccessEntry({
        childId,
        childName: child?.name || row.querySelector('.child-access-header strong')?.textContent || 'Criança',
        childAge: child?.age || null,
        email,
        password,
        familyId: familyData.family?.id || 'local'
      });
    }).filter(Boolean);
    writeChildAccessList(rows);
    showToast('Acessos infantis salvos.');
  });
}

function navigate(page) {
  const publicPages = ['login', 'onboarding', 'child-login'];
  const childFlowPages = ['crianca', 'perfil', 'loja'];
  const selectedPage = pageMeta[page] ? page : 'inicio';
  const isChildSessionPage = currentChildSession && childFlowPages.includes(selectedPage);
  if (currentChildSession && !publicPages.includes(selectedPage) && !childFlowPages.includes(selectedPage)) {
    history.replaceState({ page: 'crianca' }, '', '#crianca');
    return navigate('crianca');
  }
  if (currentChildSession && selectedPage === 'inicio') {
    history.replaceState({ page: 'crianca' }, '', '#crianca');
    return navigate('crianca');
  }
  if (!authenticated && !publicPages.includes(page) && !isChildSessionPage) {
    history.replaceState({ page: 'login' }, '', '#login');
    return navigate('login');
  }
  const childSessionActive = Boolean(currentChildSession) && !publicPages.includes(selectedPage);
  document.body.classList.toggle('auth-mode', publicPages.includes(page));
  document.body.classList.toggle('child-mode', childSessionActive);
  appView.innerHTML = selectedPage === 'inicio' ? overviewMarkup : pages[selectedPage]();
  document.querySelector('.breadcrumb strong').textContent = pageMeta[selectedPage][0];
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === selectedPage));
  document.title = `MyKids | ${pageMeta[selectedPage][0]}`;
  renderCurrentDate();
  bindThemeToggle();
  bindSearch();
  bindChildPicker();
  if (!publicPages.includes(selectedPage) && !currentChildSession) renderFamilyData();
  if (selectedPage === 'inicio') { renderOverviewActivities(); renderOverviewProgress(); bindOverviewActivities(); bindScheduleNavigation(refreshOverviewSchedule); }
  if (selectedPage === 'crianca' || selectedPage === 'perfil' || selectedPage === 'loja') {
    document.body.classList.add('child-mode');
  }
  if (selectedPage === 'estudos') bindStudyPage();
  if (selectedPage === 'responsabilidades') bindActivityPage();
  if (selectedPage === 'crianca' || selectedPage === 'perfil' || selectedPage === 'loja') bindChildPage();
  if (selectedPage === 'configuracoes') bindSettingsPage();
  bindAuthActions();
  bindPasswordToggles();
  document.querySelectorAll('.route-button').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  document.querySelectorAll('[data-child-action="logout"]').forEach((button) => button.addEventListener('click', () => { currentChildSession = null; navigate('login'); }));
  document.querySelectorAll('[data-page]').forEach((button) => {
    if (!button.dataset.boundPageNav && !button.classList.contains('nav-item')) {
      button.dataset.boundPageNav = 'true';
      button.addEventListener('click', () => navigate(button.dataset.page));
    }
  });
}

document.querySelectorAll('.nav-item[data-page]').forEach((item) => item.addEventListener('click', (event) => { event.preventDefault(); history.pushState({ page: item.dataset.page }, '', `#${item.dataset.page}`); navigate(item.dataset.page); }));
document.querySelector('#logoutAction')?.addEventListener('click', logout);
window.addEventListener('popstate', () => navigate(window.location.hash.slice(1) || 'inicio'));
window.addEventListener('hashchange', () => navigate(window.location.hash.slice(1) || 'inicio'));

async function bootstrap() {
  authenticated = Boolean(await window.MyKidsData?.getSession());
  if (authenticated) { await loadFamilyData(); await loadActivities(); await loadExams(); await loadStudySubjects(); }
  navigate(window.location.hash.slice(1) || 'inicio');
}

bootstrap();