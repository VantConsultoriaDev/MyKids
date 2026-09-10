export const MAX_OBJECTIVE_QUESTIONS = 30;
export const MAX_OPEN_QUESTIONS = 10;
export const MAX_TOTAL_QUESTIONS = 40;
export const MAX_TOPICS = 80;
export const MAX_TOPIC_LENGTH = 240;

export type ExamQuestion = {
  order: number;
  type: 'multiple_choice' | 'open';
  prompt: string;
  options: string[];
  correctOption: string | null;
  referenceAnswer: string;
  explanation: string;
  difficulty: string;
  topic: string;
  points: number;
};

export type GenerateExamInput = {
  childId: string;
  subjectId: string;
  topics: string[];
  examDate: string;
  objectiveCount: number;
  openCount: number;
  difficulty: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeTopic(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function hasMarkdown(value: string) {
  return /```|\*\*|__|\[\[|\]\]/.test(value) || /^\s*#+\s/m.test(value);
}

export function validateInput(value: unknown): GenerateExamInput {
  if (!value || typeof value !== 'object') throw new Error('Dados inválidos.');
  const input = value as Record<string, unknown>;
  const childId = String(input.childId || '');
  const subjectId = String(input.subjectId || '');
  const examDate = String(input.examDate || '');
  const difficulty = String(input.difficulty || 'medium');
  const objectiveCount = Number(input.objectiveCount);
  const openCount = Number(input.openCount);
  const topics = Array.isArray(input.topics)
    ? input.topics.map((topic) => String(topic).trim()).filter(Boolean)
    : [];

  if (!UUID_PATTERN.test(childId) || !UUID_PATTERN.test(subjectId)) throw new Error('Criança ou matéria inválida.');
  if (!DATE_PATTERN.test(examDate) || Number.isNaN(Date.parse(`${examDate}T00:00:00Z`))) throw new Error('Data da prova inválida.');
  if (!Number.isInteger(objectiveCount) || objectiveCount < 0 || objectiveCount > MAX_OBJECTIVE_QUESTIONS) throw new Error(`A quantidade objetiva deve estar entre 0 e ${MAX_OBJECTIVE_QUESTIONS}.`);
  if (!Number.isInteger(openCount) || openCount < 0 || openCount > MAX_OPEN_QUESTIONS) throw new Error(`A quantidade aberta deve estar entre 0 e ${MAX_OPEN_QUESTIONS}.`);
  if (objectiveCount + openCount < 1 || objectiveCount + openCount > MAX_TOTAL_QUESTIONS) throw new Error(`A prova deve ter entre 1 e ${MAX_TOTAL_QUESTIONS} questões.`);
  if (!topics.length || topics.length > MAX_TOPICS || topics.some((topic) => topic.length > MAX_TOPIC_LENGTH)) throw new Error('Informe temas válidos e dentro do limite permitido.');
  if (new Set(topics.map(normalizeTopic)).size !== topics.length) throw new Error('Temas duplicados não são permitidos.');
  if (!['easy', 'medium', 'hard'].includes(difficulty)) throw new Error('Dificuldade inválida.');

  return { childId, subjectId, topics, examDate, objectiveCount, openCount, difficulty };
}

export function validateQuestions(value: unknown, expectedObjective: number, expectedOpen: number, allowedTopics: string[]): ExamQuestion[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { questions?: unknown }).questions)) throw new Error('A IA retornou uma estrutura inválida.');
  const questions = (value as { questions: unknown[] }).questions as ExamQuestion[];
  if (questions.length !== expectedObjective + expectedOpen) throw new Error('A IA retornou uma quantidade incorreta de questões.');

  const normalizedAllowedTopics = allowedTopics.map(normalizeTopic);
  const objectiveCount = questions.filter((question) => question && question.type === 'multiple_choice').length;
  const openCount = questions.filter((question) => question && question.type === 'open').length;
  if (objectiveCount !== expectedObjective || openCount !== expectedOpen) throw new Error('A IA retornou tipos de questão incorretos.');

  const seenPrompts = new Set<string>();

  return questions.map((question, index) => {
    if (!question || typeof question !== 'object') throw new Error('A IA retornou uma questão inválida.');
    const type = question.type;
    const prompt = typeof question.prompt === 'string' ? question.prompt.trim() : '';
    const topic = typeof question.topic === 'string' ? question.topic.trim() : '';
    const referenceAnswer = typeof question.referenceAnswer === 'string' ? question.referenceAnswer.trim() : '';
    const explanation = typeof question.explanation === 'string' ? question.explanation.trim() : '';
    const difficulty = typeof question.difficulty === 'string' ? question.difficulty.trim() : '';
    const points = Number(question.points);
    const normalizedPrompt = prompt.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');

    if (!['multiple_choice', 'open'].includes(type)) throw new Error('Tipo de questão inválido.');
    if (!prompt || prompt.length > 1000 || hasMarkdown(prompt)) throw new Error('A IA retornou um enunciado inválido.');
    if (seenPrompts.has(normalizedPrompt)) throw new Error('A IA repetiu uma questão.');
    seenPrompts.add(normalizedPrompt);
    if (!normalizedAllowedTopics.includes(normalizeTopic(topic))) throw new Error('A IA retornou questão fora dos temas informados.');
    if (!Number.isFinite(points) || points <= 0 || points > 1000) throw new Error('A IA retornou pontuação inválida.');
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) throw new Error('Dificuldade da questão inválida.');
    if (!explanation || explanation.length > 1500 || hasMarkdown(explanation)) throw new Error('A IA retornou explicação inválida.');
    if (type === 'multiple_choice') {
      const options = Array.isArray(question.options) ? question.options.map((option) => String(option).trim()).filter(Boolean) : [];
      const correctOption = typeof question.correctOption === 'string' ? question.correctOption.trim() : '';
      if (options.length !== 5 || new Set(options).size !== options.length || !options.includes(correctOption)) throw new Error('Questão objetiva inválida.');
      if (!referenceAnswer || referenceAnswer.length > 1500 || hasMarkdown(referenceAnswer)) throw new Error('Questão objetiva sem resposta de referência válida.');
      return { ...question, order: index + 1, prompt, referenceAnswer, explanation, difficulty: difficulty.toLowerCase(), topic, points: Number(points), options, correctOption } as ExamQuestion;
    }

    if (!referenceAnswer || referenceAnswer.length > 1500 || hasMarkdown(referenceAnswer)) throw new Error('Questão aberta sem resposta de referência válida.');
    return { ...question, order: index + 1, prompt, referenceAnswer, explanation, difficulty: difficulty.toLowerCase(), topic, points: Number(points), options: [], correctOption: null } as ExamQuestion;
  });
}
