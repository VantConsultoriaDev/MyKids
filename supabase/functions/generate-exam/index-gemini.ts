import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { validateInput, validateQuestions, type ExamQuestion } from './validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const questionSchema = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'order',
          'type',
          'prompt',
          'options',
          'correctOption',
          'referenceAnswer',
          'explanation',
          'difficulty',
          'topic',
          'points',
        ],
        properties: {
          order: { type: 'integer' },
          type: { type: 'string', enum: ['multiple_choice', 'open'] },
          prompt: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
          correctOption: { type: ['string', 'null'] },
          referenceAnswer: { type: 'string' },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          topic: { type: 'string' },
          points: { type: 'number' },
        },
      },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getGeminiText(response: unknown) {
  if (response && typeof response === 'object') {
    const candidate = response as {
      candidates?: unknown;
    };

    const candidates = Array.isArray(candidate.candidates) ? candidate.candidates : [];

    for (const item of candidates) {
      if (!item || typeof item !== 'object') continue;

      const content = (item as { content?: unknown }).content;
      if (!content || typeof content !== 'object') continue;

      const parts = (content as { parts?: unknown }).parts;
      if (!Array.isArray(parts)) continue;

      const textPart = parts.find(
        (part) =>
          part &&
          typeof part === 'object' &&
          typeof (part as { text?: unknown }).text === 'string',
      ) as { text?: string } | undefined;

      if (textPart?.text) return textPart.text;
    }
  }

  throw new Error('A IA não retornou conteúdo.');
}

function parseStructuredJson(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) throw new Error('A IA retornou conteúdo vazio.');

  return JSON.parse(cleaned);
}

async function getAuthorizedContext(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Não autenticado.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configuração do Supabase ausente na Edge Function. Verifique SUPABASE_URL e SUPABASE_ANON_KEY.',
    );
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError || !userData.user) throw new Error('Não autenticado.');

  return { client, user: userData.user };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }

  try {
    const { client, user } = await getAuthorizedContext(request);

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      throw new Error('Payload inválido.');
    }

    const input = validateInput(payload);

    const { data: membership, error: membershipError } = await client
      .from('family_members')
      .select('family_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error('Família não encontrada.');
    }

    const { data: child, error: childError } = await client
      .from('children')
      .select('id, family_id, age')
      .eq('id', input.childId)
      .eq('family_id', membership.family_id)
      .maybeSingle();

    if (childError || !child) {
      throw new Error('A criança não pertence à sua família.');
    }

    const { data: subject, error: subjectError } = await client
      .from('study_subjects')
      .select('id, child_id, family_id, name')
      .eq('id', input.subjectId)
      .eq('child_id', input.childId)
      .eq('family_id', membership.family_id)
      .eq('active', true)
      .maybeSingle();

    if (subjectError || !subject) {
      throw new Error('Matéria não encontrada para esta criança.');
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada na Edge Function.');
    }

    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

    const age = child.age
      ? `A criança tem ${child.age} anos.`
      : 'A idade da criança não foi informada.';

    const prompt = [
      'Gere uma prévia de prova infantil usando exclusivamente os temas informados.',
      `Matéria: ${subject.name}.`,
      age,
      `Data da prova: ${input.examDate}.`,
      `Dificuldade: ${input.difficulty}.`,
      `Crie ${input.objectiveCount} questão(ões) objetiva(s) e ${input.openCount} questão(ões) aberta(s).`,
      `Temas permitidos: ${input.topics.join(' | ')}.`,
      'Não repita questões.',
      'Não use Markdown.',
      'Não invente conteúdo fora dos temas.',
      'Para questões objetivas, gere exatamente 5 alternativas e informe qual delas é a correta.',
      'Para questões abertas, options deve ser uma lista vazia e correctOption deve ser null.',
      'Retorne somente o objeto JSON solicitado pelo esquema.',
    ].join('\n');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: questionSchema,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();

      let parsedError: {
        error?: {
          message?: string;
          status?: string;
          code?: number;
        };
      } | null = null;

      try {
        parsedError = JSON.parse(errorBody) as {
          error?: {
            message?: string;
            status?: string;
            code?: number;
          };
        };
      } catch {
        parsedError = null;
      }

      const geminiMessage =
        parsedError?.error?.message ||
        errorBody ||
        'Erro desconhecido da Gemini API.';

      console.error('Gemini API error:', {
        status: geminiResponse.status,
        code: parsedError?.error?.code ?? null,
        apiStatus: parsedError?.error?.status ?? null,
        message: geminiMessage,
      });

      if (geminiResponse.status === 429) {
        throw new Error(
          'Gemini: limite gratuito da API atingido. Tente novamente mais tarde.',
        );
      }

      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        throw new Error(
          'Gemini: a chave da API foi rejeitada. Verifique GEMINI_API_KEY no Supabase.',
        );
      }

      throw new Error(`Gemini: ${geminiMessage}`);
    }

    const responseBody = await geminiResponse.json();
    const generated = parseStructuredJson(getGeminiText(responseBody));

    const questions: ExamQuestion[] = validateQuestions(
      generated,
      input.objectiveCount,
      input.openCount,
      input.topics,
    );

    return jsonResponse({
      preview: true,
      childId: input.childId,
      subjectId: input.subjectId,
      subjectName: subject.name,
      examDate: input.examDate,
      difficulty: input.difficulty,
      questions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível gerar a prévia.';

    const status = message === 'Não autenticado.' ? 401 : 400;

    return jsonResponse({ error: message }, status);
  }
});
