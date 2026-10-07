// Turns a person's answers (1 to 5) into scores, and scores into a result page model.
const TRAITS = { O: 'Openness', C: 'Conscientiousness', E: 'Extraversion', A: 'Agreeableness', N: 'Emotional reactivity' };

const TRAIT_TIPS = {
  O: { hi: 'You enjoy new ideas. Mix videos, projects and discussions into your study.', lo: 'You prefer proven methods. Keep them, and add one new technique at a time.' },
  C: { hi: 'You plan well. Use a weekly schedule and protect your routine.', lo: 'Break work into 25-minute blocks and set small deadlines to stay on track.' },
  E: { hi: 'Study groups and talking ideas through will keep you motivated.', lo: 'Quiet, solo sessions suit you. Schedule time to recharge after group work.' },
  A: { hi: 'You work well with others. Peer teaching and group projects are a strength.', lo: 'You tend to be direct. In teamwork, check other people\'s views before deciding.' },
  N: { hi: 'You may feel stress strongly. Add buffer time before deadlines and practise a short relaxation routine.', lo: 'You tend to stay calm under pressure. Keep a steady routine.' },
};

const SCALES = {
  'exam-stress': {
    label: 'Exam stress',
    support: true,
    tips: [
      'Your exam stress looks low. Keep your routine and your sleep.',
      'Your exam stress is moderate. Add buffer days, short breaks and regular sleep before exams.',
      'Your exam stress is high. Break study into small daily steps and protect your sleep.',
    ],
  },
  procrastination: {
    label: 'Procrastination',
    tips: [
      'You tend to start early. Keep that habit.',
      'You sometimes delay. Try 25-minute focus blocks.',
      'You often delay work. Start with a five-minute first step and keep your phone out of reach.',
    ],
  },
  'career-interest': {
    label: 'Technical interest',
    tips: [
      'Your interest in technical work looks low. Explore people-focused or creative fields too.',
      'You show a mix of interests. Try short projects in different fields to compare.',
      'You show a strong technical interest. Explore computing, engineering and data careers.',
    ],
  },
};

const BANDS = ['Low', 'Moderate', 'High'];
const bandIndex = (pct) => (pct >= 67 ? 2 : pct >= 34 ? 1 : 0);

// questions: [{id, trait, reversed}], answers: { [questionId]: 1..5 }
function score(test, questions, answers) {
  const val = (q) => (q.reversed ? 6 - answers[q.id] : answers[q.id]);
  if (test.kind === 'bigfive') {
    const sum = {}, count = {};
    questions.forEach((q) => {
      sum[q.trait] = (sum[q.trait] || 0) + val(q);
      count[q.trait] = (count[q.trait] || 0) + 1;
    });
    const out = { type: 'bigfive' };
    Object.keys(TRAITS).forEach((t) => {
      out[t] = count[t] ? Math.round(((sum[t] - count[t]) / (4 * count[t])) * 100) : null;
    });
    return out;
  }
  const n = questions.length;
  const total = questions.reduce((a, q) => a + val(q), 0);
  const pct = Math.round(((total - n) / (4 * n)) * 100);
  return { type: 'scale', pct, band: BANDS[bandIndex(pct)] };
}

// Builds what the result page shows, from stored scores.
function present(test, scores) {
  if (scores.type === 'bigfive') {
    return {
      title: test.title,
      headline: 'Your trait profile',
      note: 'Each bar shows where you sit between the two ends of a trait. No end is better than the other.',
      support: false,
      bars: Object.keys(TRAITS)
        .filter((t) => scores[t] !== null)
        .map((t) => ({ label: TRAITS[t], pct: scores[t], tip: TRAIT_TIPS[t][scores[t] >= 50 ? 'hi' : 'lo'] })),
    };
  }
  const s = SCALES[test.slug] || { label: test.title, tips: ['Your score on this test is low.', 'Your score on this test is moderate.', 'Your score on this test is high.'] };
  const k = Math.max(0, BANDS.indexOf(scores.band));
  return {
    title: test.title,
    headline: `${s.label}: ${scores.band}`,
    note: 'This is an informal self-check, not a clinical test.',
    support: !!s.support && k === 2,
    bars: [{ label: s.label, pct: scores.pct, tip: s.tips[k] }],
  };
}

module.exports = { score, present };
