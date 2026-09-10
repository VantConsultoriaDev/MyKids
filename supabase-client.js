(() => {
  const config = window.MYKIDS_SUPABASE_CONFIG || {};
  const isConfigured = config.url && config.anonKey
    && !config.url.includes('SEU-PROJETO')
    && !config.anonKey.includes('SUA_CHAVE');

  if (!isConfigured || !window.supabase) {
    window.MyKidsData = {
      enabled: false,
      async signIn() { throw new Error('Configure supabase-config.js antes de entrar.'); },
      async signUp() { throw new Error('Configure supabase-config.js antes de criar a família.'); },
      async signOut() { return undefined; },
      async getSession() { return null; },
      async getFamilyDashboard() { return { family: null, children: [], responsibleName: '' }; },
      async listActivities() { throw new Error('Configure o Supabase e execute supabase-activities.sql antes de usar atividades.'); },
      async createActivity() { throw new Error('Configure o Supabase e execute supabase-activities.sql antes de usar atividades.'); },
      async updateActivity() { throw new Error('Configure o Supabase e execute supabase-activities.sql antes de usar atividades.'); },
      async deleteActivity() { throw new Error('Configure o Supabase e execute supabase-activities.sql antes de usar atividades.'); },
      async saveActivityOccurrence() { throw new Error('Configure o Supabase e execute supabase-activities.sql antes de usar atividades.'); },
      async listStudySubjects() { throw new Error('Execute supabase-studies.sql antes de usar matérias.'); },
      async createStudySubject() { throw new Error('Execute supabase-studies.sql antes de usar matérias.'); },
      async updateStudySubject() { throw new Error('Execute supabase-studies.sql antes de usar matérias.'); },
      async deleteStudySubject() { throw new Error('Execute supabase-studies.sql antes de usar matérias.'); },
      async updateExam() { throw new Error('Execute supabase-exams.sql antes de editar provas.'); },
      async deleteExam() { throw new Error('Execute supabase-exams.sql antes de excluir provas.'); },
      async generateExamPreview() { throw new Error('Configure a Edge Function generate-exam antes de gerar provas.'); },
      async approveExam() { throw new Error('Execute a atualização de supabase-exams.sql antes de aprovar provas.'); },
      async createExam() { throw new Error('Execute supabase-exams.sql antes de criar provas.'); }
      ,async listExams() { throw new Error('Execute supabase-exams.sql antes de listar provas.'); }
    };
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey);
  async function provisionFamily(user) {
    const metadata = user.user_metadata || {};
    const children = Array.isArray(metadata.children)
      ? metadata.children
      : [{ name: metadata.child_name || 'Minha criança', age: metadata.child_age }];
    const { data: familyId, error } = await client.rpc('provision_family', {
      p_family_name: metadata.family_name || 'Minha família',
      p_children: children,
      p_objectives: metadata.objectives || []
    });
    if (error) {
      if (error.code === 'PGRST202') {
        throw new Error('A função de provisionamento ainda não foi publicada. Execute supabase-provision-family.sql no Supabase SQL Editor.');
      }
      throw error;
    }
    return familyId;
  }

  window.MyKidsData = {
    enabled: true,
    client,
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user.user_metadata?.onboarding_complete) await provisionFamily(data.user);
      return data;
    },
    async signUp({ email, password, name, familyName, children, objectives }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name, family_name: familyName, children, objectives, onboarding_complete: true } }
      });
      if (error) throw error;
      if (!data.user) return data;
      if (data.session) await provisionFamily(data.user);
      return data;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session;
    },
    async getFamilyDashboard() {
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return { family: null, children: [], responsibleName: '' };

      const { data: membership, error: membershipError } = await client
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return { family: null, children: [], responsibleName: user.user_metadata?.name || '' };

      const { data: family, error: familyError } = await client
        .from('families')
        .select('id, name, objectives')
        .eq('id', membership.family_id)
        .maybeSingle();
      if (familyError) throw familyError;
      if (!family) return { family: null, children: [], responsibleName: user.user_metadata?.name || '' };

      const { data: children, error: childrenError } = await client
        .from('children')
        .select('id, name, age, avatar, theme, xp, points, streak_days')
        .eq('family_id', family.id)
        .order('created_at', { ascending: true });
      if (childrenError) throw childrenError;
      return {
        family,
        children: children || [],
        responsibleName: user.user_metadata?.name || ''
      };
    },
    async listActivities(familyId) {
      const { data, error } = await client.from('activities').select('id, family_id, child_id, created_by, kind, name, subject, subtopic, recurrence, start_time, duration_minutes, notes, xp_base, points_base, active, created_at, updated_at').eq('family_id', familyId).eq('active', true).order('start_time', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
      if (error) {
        if (error.code === 'PGRST205') throw new Error('A tabela de atividades ainda não foi criada. Execute supabase-activities.sql no SQL Editor do Supabase.');
        throw error;
      }
      if (!data?.length) return [];
      const { data: occurrences, error: occurrenceError } = await client.from('activity_occurrences').select('activity_id, occurrence_date, status').in('activity_id', data.map((activity) => activity.id));
      if (occurrenceError) throw occurrenceError;
      return data.map((activity) => ({ ...activity, occurrences: (occurrences || []).filter((occurrence) => occurrence.activity_id === activity.id) }));
    },
    async createActivity(payload) {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Sua sessão expirou. Entre novamente.');
      const { data, error } = await client.from('activities').insert({ ...payload, created_by: userId }).select().single();
      if (error) throw error;
      return data;
    },
    async updateActivity(id, payload) {
      const { data, error } = await client.from('activities').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async deleteActivity(id) {
      const { error } = await client.from('activities').update({ active: false }).eq('id', id);
      if (error) throw error;
    },
    async saveActivityOccurrence({ activityId, childId, date, status }) {
      const { data: sessionData } = await client.auth.getSession();
      const { data, error } = await client.from('activity_occurrences').upsert({ activity_id: activityId, child_id: childId, occurrence_date: date, status, completed_by: status === 'completed' ? sessionData.session?.user?.id : null, completed_at: status === 'completed' ? new Date().toISOString() : null }, { onConflict: 'activity_id,occurrence_date' }).select().single();
      if (error) throw error;
      return data;
    },
    async listStudySubjects(familyId) {
      const { data, error } = await client.from('study_subjects').select('id, family_id, child_id, name, description, topics, created_at, updated_at').eq('family_id', familyId).eq('active', true).order('name', { ascending: true });
      if (error) { if (error.code === 'PGRST205') throw new Error('A tabela de matérias ainda não foi criada. Execute supabase-studies.sql no SQL Editor do Supabase.'); throw error; }
      return data || [];
    },
    async createStudySubject({ familyId, childId, name, description, topics }) {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Sua sessão expirou. Entre novamente.');
      const { data, error } = await client.from('study_subjects').insert({ family_id: familyId, child_id: childId, created_by: userId, name, description: description || '', topics: topics || [] }).select().single();
      if (error) throw error;
      return data;
    },
    async updateStudySubject(id, { childId, name, description, topics }) {
      const { data, error } = await client.from('study_subjects').update({ child_id: childId, name, description: description || '', topics: topics || [], updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async deleteStudySubject(id) {
      const { error } = await client.from('study_subjects').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    async createExam({ familyId, childId, name, scheduledDate, startTime, durationMinutes, subjects, questions, xpTotal, pointsTotal }) {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Sua sessão expirou. Entre novamente.');
      const { data: exam, error: examError } = await client.from('exams').insert({ family_id: familyId, child_id: childId, created_by: userId, name, scheduled_date: scheduledDate, start_time: startTime, duration_minutes: durationMinutes, subjects, question_count: 15, xp_total: xpTotal, points_total: pointsTotal }).select().single();
      if (examError) throw examError;
      const questionRows = questions.map((question, index) => ({ exam_id: exam.id, position: index + 1, question_type: question.type, prompt: question.prompt, options: question.options || [], correct_option: question.correctOption || null, reference_answer: question.referenceAnswer || null, xp: question.xp, points: question.points }));
      const { error: questionError } = await client.from('exam_questions').insert(questionRows);
      if (questionError) { await client.from('exams').delete().eq('id', exam.id); throw questionError; }
      return exam;
    },
    async updateExam({ examId, name, scheduledDate, startTime, durationMinutes, subjects, questions, xpTotal, pointsTotal }) {
      const { data: exam, error: examError } = await client.from('exams').update({ name, scheduled_date: scheduledDate, start_time: startTime, duration_minutes: durationMinutes, subjects, question_count: 15, xp_total: xpTotal, points_total: pointsTotal, updated_at: new Date().toISOString() }).eq('id', examId).select().single();
      if (examError) throw examError;
      const { error: deleteQuestionsError } = await client.from('exam_questions').delete().eq('exam_id', examId);
      if (deleteQuestionsError) throw deleteQuestionsError;
      const questionRows = questions.map((question, index) => ({ exam_id: examId, position: index + 1, question_type: question.type, prompt: question.prompt, options: question.options || [], correct_option: question.correctOption || null, reference_answer: question.referenceAnswer || null, xp: question.xp, points: question.points }));
      const { error: questionError } = await client.from('exam_questions').insert(questionRows);
      if (questionError) throw questionError;
      return exam;
    },
    async deleteExam(examId) {
      const { error } = await client.from('exams').update({ active: false, updated_at: new Date().toISOString() }).eq('id', examId);
      if (error) throw error;
    },
    async generateExamPreview(payload) {
      const { data, error } = await client.functions.invoke('generate-exam', { body: payload });
      if (error) {
        console.error('Erro da Edge Function:', error);

        const context = error?.context && typeof error.context === 'object' ? error.context : null;
        let detail = 'Não foi possível gerar a prévia da prova.';

        try {
          if (typeof context?.text === 'function') {
            const responseText = await context.text();
            if (responseText) {
              console.error('Resposta da Edge Function:', responseText);
              try {
                const parsed = JSON.parse(responseText);
                detail = parsed?.error || parsed?.message || responseText;
              } catch {
                detail = responseText;
              }
            }
          }
        } catch (readError) {
          console.warn('Não foi possível ler a resposta da Edge Function.', readError);
        }

        if (!detail || detail === 'Não foi possível gerar a prévia da prova.') {
          detail = context?.error || context?.message || error.message || detail;
        }

        throw new Error(String(detail).trim() || 'Não foi possível gerar a prévia da prova.');
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    async approveExam({ creationKey, childId, name, scheduledDate, startTime, durationMinutes, subjects, xpTotal, pointsTotal, questions }) {
      const { data, error } = await client.rpc('approve_exam_with_questions', { p_creation_key: creationKey, p_child_id: childId, p_name: name, p_scheduled_date: scheduledDate, p_start_time: startTime, p_duration_minutes: durationMinutes, p_subjects: subjects, p_xp_total: xpTotal, p_points_total: pointsTotal, p_questions: questions });
      if (error) throw error;
      return data;
    },
    async listExams(familyId) {
      const { data, error } = await client.from('exams').select('id, family_id, child_id, name, scheduled_date, start_time, duration_minutes, subjects, question_count, xp_total, points_total, created_at').eq('family_id', familyId).eq('active', true).order('scheduled_date', { ascending: true }).order('start_time', { ascending: true });
      if (error) { if (error.code === 'PGRST205') throw new Error('A tabela de provas ainda não foi criada. Execute supabase-exams.sql no SQL Editor do Supabase.'); throw error; }
      return data || [];
    },
    async getExam(examId) {
      const { data: exam, error: examError } = await client.from('exams').select('*').eq('id', examId).single();
      if (examError) throw examError;
      const { data: questions, error: questionError } = await client.from('exam_questions').select('*').eq('exam_id', examId).order('position', { ascending: true });
      if (questionError) throw questionError;
      return { ...exam, questions: questions || [] };
    },
    async saveExamAttempt({ examId, childId, status, answers, score, startedAt }) {
      const { data: attempt, error: attemptError } = await client.from('exam_attempts').upsert({ exam_id: examId, child_id: childId, started_at: startedAt || new Date().toISOString(), submitted_at: status === 'submitted' ? new Date().toISOString() : null, status, score: score || 0 }, { onConflict: 'exam_id,child_id' }).select().single();
      if (attemptError) throw attemptError;
      if (answers?.length) {
        const rows = answers.map((answer) => ({ attempt_id: attempt.id, question_id: answer.questionId, answer_text: answer.answerText || null, is_correct: answer.isCorrect, awarded_points: answer.awardedPoints || 0 }));
        const { error } = await client.from('exam_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
        if (error) throw error;
      }
      return attempt;
    }
  };
})();
