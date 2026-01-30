// =============================================
// components/assessments/AutoGrade.ts
// =============================================
export type AnswersMap = Record<string, any>
export type AutoGradeResult = {
  totalPoints: number
  earnedPoints: number
  byQuestion: { id: string; points: number; earned: number; correct: boolean }[]
}

export function autoGrade (fields: Array<{ id: string; type: string; points?: number; correctAnswer?: any }>, answers: AnswersMap): AutoGradeResult {
  const out: AutoGradeResult = { totalPoints: 0, earnedPoints: 0, byQuestion: [] }
  for (const f of fields) {
    if (f.type === 'heading') continue
    const pts = Number(f.points ?? 1)
    out.totalPoints += pts
    const ans = answers?.[f.id]
    let correct = false

    switch (f.type) {
      case 'radio':
        correct = f.correctAnswer != null && ans === f.correctAnswer
        break
      case 'checkbox': {
        const key = Array.isArray(f.correctAnswer) ? f.correctAnswer.slice().sort().join('||') : ''
        const got = Array.isArray(ans) ? ans.slice().sort().join('||') : ''
        correct = !!key && key === got
        break
      }
      case 'number':
      case 'rating':
        correct = typeof f.correctAnswer === 'number' && Number(ans) === Number(f.correctAnswer)
        break
      default:
        // short/long: manual grading later (0 by default)
        correct = false
    }

    const earned = correct ? pts : 0
    out.earnedPoints += earned
    out.byQuestion.push({ id: f.id, points: pts, earned, correct })
  }
  return out
}
