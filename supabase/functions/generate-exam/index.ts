import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { validateInput, validateQuestions, type ExamQuestion } from './validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const questionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['order', 'type', 'prompt', 'options', 'correctOption', 'referenceAnswer', 'explanation', 'difficulty', 'topic', 'points'],
        properties: {
          order: { type: 'integer', minimum: 1 },
          type: { type: 'string', enum: ['multiple_choice', 'open'] },
          prompt: { type: 'string', minLength: 1, maxLength: 1000 },
          options: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 240 } },
          correctOption: { type: ['string', 'null'] },
          referenceAnswer: { type: 'string', minLength: 1, maxLength: 1500 },
          explanation: { type: 'string', minLength: 1, maxLength: 1500 },
          difficulty: { type: 'string', minLength: 1, maxLength: 30 },
          topic: { type: 'string', minLength: 1, maxLength: 240 },
          points: { type: 'number', exclusiveMinimum: 0 },
        },
      },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function getOutputText(response: unknown) {
  if (response && typeof response === 'object') {
    const candidate = response as { output_text?: unknown; output?: unknown };
    if (typeof candidate.output_text === 'string') return candidate.output_text;
    const output = Array.isArray(candidate.output) ? candidate.output : [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as { content?: unknown };
      const content = Array.isArray(entry.content) ? entry.content : [];
      const text = content.find((part) => part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') as { text?: string } | undefined;
      if (text?.text) return text.text;
    }
  }
  throw new Error('A IA não retornou conteúdo.');
}

function parseStructuredJson(rawText: string) {
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!cleaned) throw new Error('A IA retornou conteúdo vazio.');
  return JSON.parse(cleaned);
}

async function getAuthorizedContext(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Não autenticado.');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Configuração do Supabase ausente.');
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error('Não autenticado.');
  return { client, user: userData.user };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405);

  try {
    const { client, user } = await getAuthorizedContext(request);
    const input = validateInput(await request.json());
    const { data: membership, error: membershipError } = await client.from('family_members').select('family_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (membershipError || !membership) throw new Error('Família não encontrada.');
    const { data: child, error: childError } = await client.from('children').select('id, family_id, age').eq('id', input.childId).eq('family_id', membership.family_id).maybeSingle();
    if (childError || !child) throw new Error('A criança não pertence à sua família.');
    const { data: subject, error: subjectError } = await client.from('study_subjects').select('id, child_id, family_id, name').eq('id', input.subjectId).eq('child_id', input.childId).eq('family_id', membership.family_id).eq('active', true).maybeSingle();
    if (subjectError || !subject) throw new Error('Matéria não encontrada para esta criança.');

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY não configurada na Edge Function.');
    const age = child.age ? `A criança tem ${child.age} anos.` : 'A idade da criança não foi informada.';
    const prompt = [
      'Gere uma prévia de prova infantil usando exclusivamente os temas informados.',
      `Matéria: ${subject.name}.`,
      age,
      `Data da prova: ${input.examDate}.`,
      `Dificuldade: ${input.difficulty}.`,
      `Crie ${input.objectiveCount} questão(ões) objetiva(s) e ${input.openCount} questão(ões) aberta(s).`,
      `Temas permitidos: ${input.topics.join(' | ')}.`,
      'Não repita questões, não use Markdown e não invente conteúdo fora dos temas.',
    ].join('\n');
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
        input: prompt,
        temperature: 0.3,
        text: { format: { type: 'json_schema', name: 'exam_preview', strict: true, schema: questionSchema } },
      }),
    });

    if (!openAiResponse.ok) {
      const errorBody = await openAiResponse.text();
      let parsedError: { error?: { message?: string; type?: string; code?: string | number; param?: string } } | null = null;

      try {
        parsedError = JSON.parse(errorBody) as { error?: { message?: string; type?: string; code?: string | number; param?: string } };
      } catch {
        parsedError = null;
      }

      const openAiMessage = parsedError?.error?.message || errorBody || 'Erro desconhecido da OpenAI.';

      console.error('OpenAI API error:', {
        status: openAiResponse.status,
        type: parsedError?.error?.type ?? null,
        code: parsedError?.error?.code ?? null,
        param: parsedError?.error?.param ?? null,
        message: openAiMessage,
      });

      throw new Error(`OpenAI: ${openAiMessage}`);
    }

    const responseBody = await openAiResponse.json();
    const generated = parseStructuredJson(getOutputText(responseBody));
    const questions: ExamQuestion[] = validateQuestions(generated, input.objectiveCount, input.openCount, input.topics);
    return jsonResponse({ preview: true, childId: input.childId, subjectId: input.subjectId, subjectName: subject.name, examDate: input.examDate, difficulty: input.difficulty, questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar a prévia.';
    const status = message === 'Não autenticado.' ? 401 : 400;
    return jsonResponse({ error: message }, status);
  }
});
