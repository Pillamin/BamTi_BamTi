/*
 * Vercel Serverless Function: Gemini 상담 전략 API
 *
 * [보안 주석]
 * 1. 프론트엔드에 API 키를 넣으면 개발자 도구에서 노출될 수 있다.
 * 2. Gemini API 호출은 이 Vercel Serverless Function에서만 처리한다.
 * 3. .env 파일은 GitHub에 올리지 않는다.
 * 4. Vercel 배포 시에는 Project Settings → Environment Variables에 GEMINI_API_KEY를 등록해야 한다.
 * 5. Gemini로 전송하는 데이터는 이름, 학번, 사진 경로를 제외한 최소 정보로 제한한다.
 *
 * 외부 npm 패키지 없이 Node.js 내장 fetch를 사용한다.
 */

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST 요청만 허용됩니다." });
  }

  const { studentAlias, gradeSummary, learningTraits, teacherConcern } = req.body || {};

  // 필수 값 검증
  if (!studentAlias || !gradeSummary || !learningTraits || !teacherConcern) {
    return res.status(400).json({
      success: false,
      error: "studentAlias, gradeSummary, learningTraits, teacherConcern 값이 모두 필요합니다.",
    });
  }

  // API 키 확인
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.",
    });
  }

  // Gemini에게 보낼 시스템 프롬프트
  const systemInstruction = `당신은 교사를 위한 학생 상담 전략 도우미 AI입니다.

[핵심 원칙]
- 학생을 단정적으로 판단하거나 진단하지 마세요.
- "의지가 부족하다", "주의력 문제가 있다", "심리적 문제가 있다"처럼 단정하는 표현을 피하세요.
- 교사가 학생을 이해하고 대화할 수 있도록 돕는 방향으로 응답하세요.

[응답 형식 – 반드시 아래 6개 항목으로 구성하세요]
1. 현재 상황 요약
2. 학생 데이터 기반 해석
3. 상담 접근 전략
4. 교사가 던질 수 있는 질문 3개
5. 피해야 할 말 또는 주의점
6. 다음 수업에서 해볼 수 있는 작은 지원

각 항목은 "## 1. 현재 상황 요약" 형식의 마크다운 제목으로 시작하세요.
응답은 한국어로 작성하세요.`;

  // Gemini에게 보낼 사용자 메시지
  const userMessage = `다음은 익명화된 학생 정보와 교사의 상담 고민입니다.

학생 별칭: ${studentAlias}
성적 요약: ${gradeSummary}
학습 특성: ${learningTraits}

교사의 상담 고민:
${teacherConcern}

위 정보를 바탕으로 상담 전략을 제안해주세요.`;

  // Gemini REST API 호출 (gemini-2.5-pro 모델, 내장 fetch 사용)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({
        success: false,
        error: `Gemini API 오류 (${response.status}): ${errorBody}`,
      });
    }

    const data = await response.json();

    // Gemini 응답에서 텍스트 추출
    const resultText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gemini 응답에서 텍스트를 추출하지 못했습니다.";

    return res.status(200).json({ success: true, result: resultText });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `서버 오류: ${err.message}`,
    });
  }
}
