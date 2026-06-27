/*
 * [보안 주석]
 * 1. 프론트엔드에 API 키를 넣으면 개발자 도구(Network 탭 등)에서 노출될 수 있다.
 * 2. Gemini API 호출은 Vercel Serverless Function(/api/gemini-counseling)에서 처리한다.
 * 3. .env 파일은 GitHub에 올리지 않는다.
 * 4. Vercel 배포 시에는 Project Settings → Environment Variables에 GEMINI_API_KEY를 등록해야 한다.
 * 5. Gemini로 전송하는 데이터는 이름, 학번, 사진 경로를 제외한 최소 정보로 제한한다.
 */

const USERS = [
  { id: "admin", password: "2026", role: "admin", name: "관리자" },
  { id: "10101", password: "1234", role: "student", studentId: "10101" },
  { id: "10102", password: "1234", role: "student", studentId: "10102" },
  { id: "10103", password: "1234", role: "student", studentId: "10103" },
];

const STUDENTS = [
  {
    id: "10101",
    name: "김코딩",
    photo: "assets/10101_김코딩.jpg",
    grades: {
      "정보 수행평가": "A",
      "웹앱 프로젝트": "92점",
      "디지털 윤리 퀴즈": "88점",
      "수업 참여도": "상",
    },
    traits: [
      "문제 해결 과정을 차분히 설명합니다.",
      "새 도구를 시도할 때 기록을 꼼꼼히 남깁니다.",
      "제출 전 확인 습관을 더 연습하면 좋습니다.",
    ],
    teacherMemo: "프론트엔드 구조 이해가 빠르며, 팀원 질문에 답하는 태도가 좋습니다.",
  },
  {
    id: "10102",
    name: "박개발",
    photo: "assets/10102_박개발.jpg",
    grades: {
      "정보 수행평가": "B+",
      "웹앱 프로젝트": "86점",
      "디지털 윤리 퀴즈": "91점",
      "수업 참여도": "중상",
    },
    traits: [
      "협업 중 역할 분담을 잘 지킵니다.",
      "UI 수정 아이디어를 자주 제안합니다.",
      "프로젝트 범위를 작게 나누는 연습이 필요합니다.",
    ],
    teacherMemo: "기능 구현 의욕이 높고, 오류가 날 때 원인을 함께 추적하려는 태도가 좋습니다.",
  },
  {
    id: "10103",
    name: "이교사",
    photo: "assets/10103_이교사.jpg",
    grades: {
      "정보 수행평가": "A-",
      "웹앱 프로젝트": "89점",
      "디지털 윤리 퀴즈": "95점",
      "수업 참여도": "상",
    },
    traits: [
      "학습 내용을 자기 언어로 정리합니다.",
      "개선할 지점을 발견하면 근거를 함께 제시합니다.",
      "코드 주석을 더 구체적으로 쓰면 좋습니다.",
    ],
    teacherMemo: "질문의 초점이 좋고, 개선 방향을 토의하는 데 적극적입니다.",
  },
];

/* ── 학생 익명화 별칭 매핑 (이름·학번·사진 경로를 Gemini에 보내지 않기 위함) ── */
const STUDENT_ALIAS_MAP = {};
STUDENTS.forEach((s, i) => {
  STUDENT_ALIAS_MAP[s.id] = "학생 " + String.fromCharCode(65 + i); // "학생 A", "학생 B", "학생 C"
});

const loginForm = document.querySelector("#loginForm");
const userIdInput = document.querySelector("#userId");
const passwordInput = document.querySelector("#password");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const loginView = document.querySelector("#loginView");
const studentView = document.querySelector("#studentView");
const adminView = document.querySelector("#adminView");

let currentUser = null;

/* ── 현재 상담 패널에서 선택된 학생 ── */
let selectedCounselingStudent = null;

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = userIdInput.value.trim();
  const password = passwordInput.value;
  const user = USERS.find((item) => item.id === id && item.password === password);

  if (!user) {
    loginMessage.textContent = "아이디 또는 비밀번호가 올바르지 않습니다.";
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  currentUser = user;
  loginMessage.textContent = "";
  loginForm.reset();

  if (user.role === "admin") {
    renderAdminDashboard();
  } else {
    const student = STUDENTS.find((item) => item.id === user.studentId);
    renderStudentPage(student);
  }
});

logoutButton.addEventListener("click", () => {
  currentUser = null;
  selectedCounselingStudent = null;
  showOnly(loginView);
  logoutButton.classList.add("hidden");
  userIdInput.focus();
});

function showOnly(targetView) {
  [loginView, studentView, adminView].forEach((view) => view.classList.add("hidden"));
  targetView.classList.remove("hidden");
}

function renderStudentPage(student) {
  if (!student) {
    loginMessage.textContent = "학생 정보를 찾을 수 없습니다.";
    showOnly(loginView);
    return;
  }

  studentView.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <p class="eyebrow">Student</p>
        <h2>${student.name} 학생 페이지</h2>
        <p>로그인한 학생의 학습 현황을 확인합니다.</p>
      </div>
    </div>

    <div class="student-layout">
      <article class="student-profile">
        <img class="student-photo" src="${student.photo}" alt="${student.name} 학생 사진" />
        <div class="profile-body">
          <h3>${student.name}</h3>
          <p class="student-number">학번 ${student.id}</p>
          <div class="tag-row" aria-label="학습 키워드">
            <span class="tag">정보</span>
            <span class="tag">프로젝트</span>
          </div>
        </div>
      </article>

      <div class="content-stack">
        ${renderGrades(student.grades, false, "gradesTitle-" + student.id)}
        ${renderTraits(student)}
      </div>
    </div>
  `;

  showOnly(studentView);
  logoutButton.classList.remove("hidden");
}

function renderAdminDashboard() {
  adminView.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <p class="eyebrow">Admin</p>
        <h2>관리자 대시보드</h2>
        <p>학생 3명의 학습 현황을 한 화면에서 비교합니다.</p>
      </div>
    </div>

    <section class="admin-grid" aria-label="전체 학생 정보">
      ${STUDENTS.map(renderStudentCard).join("")}
    </section>

    ${renderCounselingPanel()}
  `;

  showOnly(adminView);
  logoutButton.classList.remove("hidden");

  /* 상담 전략 요청 버튼 이벤트 바인딩 */
  adminView.querySelectorAll(".counseling-request-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const studentId = btn.dataset.studentId;
      const student = STUDENTS.find((s) => s.id === studentId);
      if (student) {
        selectStudentForCounseling(student);
      }
    });
  });

  /* AI 상담 전략 받기 버튼 이벤트 바인딩 */
  const submitBtn = adminView.querySelector("#counselingSubmitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleCounselingSubmit);
  }

  /* textarea 입력 시 미리보기 갱신 */
  const textarea = adminView.querySelector("#counselingConcern");
  if (textarea) {
    textarea.addEventListener("input", updatePreview);
  }
}

function renderStudentCard(student) {
  return `
    <article class="student-card">
      <img class="student-photo" src="${student.photo}" alt="${student.name} 학생 사진" />
      <div class="student-card-body">
        <h3>${student.name}</h3>
        <p class="student-number">학번 ${student.id}</p>
        ${renderGrades(student.grades, true, "gradesTitle-" + student.id)}
        ${renderTraits(student)}
        <button class="counseling-request-btn" type="button" data-student-id="${student.id}">
          상담 전략 요청
        </button>
      </div>
    </article>
  `;
}

function renderGrades(grades, compact, headingId) {
  const rows = Object.entries(grades)
    .map(function (entry) {
      return "<tr><th scope=\"row\">" + entry[0] + "</th><td>" + entry[1] + "</td></tr>";
    })
    .join("");

  return '<section aria-labelledby="' + headingId + '">' +
    '<div class="section-title"><h3 id="' + headingId + '">성적 정보</h3></div>' +
    '<table class="grade-table' + (compact ? " compact-table" : "") + '">' +
    "<tbody>" + rows + "</tbody></table></section>";
}

function renderTraits(student) {
  var items = student.traits.map(function (t) { return "<li>" + t + "</li>"; }).join("");
  items += "<li>" + student.teacherMemo + "</li>";

  return '<section aria-labelledby="traitsTitle-' + student.id + '">' +
    '<div class="section-title"><h3 id="traitsTitle-' + student.id + '">학습 특성 및 교사 메모</h3></div>' +
    '<ul class="memo-list">' + items + "</ul></section>";
}

/* ══════════════════════════════════════════════════════════
 * AI 상담 전략 도우미 – 관리자 페이지 삽입 패널
 * ══════════════════════════════════════════════════════════ */

function renderCounselingPanel() {
  var placeholder = "예시:\n" +
    "• 수업 참여는 좋은데 평가 결과가 낮습니다. 어떻게 상담하면 좋을까요?\n" +
    "• 과제 제출이 자주 늦습니다. 혼내기보다는 원인을 파악하고 싶은데 어떻게 접근하면 좋을까요?\n" +
    "• 친구들과 협업할 때 소극적인 편입니다. 어떤 질문으로 대화를 시작하면 좋을까요?";

  return '<section class="counseling-panel" aria-label="AI 상담 전략 도우미">' +
    '<div class="counseling-panel-header">' +
      '<h3>🤖 AI 학생 상담 전략 도우미</h3>' +
    '</div>' +
    '<div class="counseling-panel-body">' +

      /* 선택된 학생 표시 영역 */
      '<div id="counselingStudentInfo" class="selected-student-info">' +
        '<p class="selected-student-label">선택된 학생</p>' +
        '<p>위 학생 카드에서 <strong>상담 전략 요청</strong> 버튼을 눌러주세요.</p>' +
      '</div>' +

      /* 교사 고민 입력 */
      '<div>' +
        '<label class="field-label" for="counselingConcern">교사 상담 고민</label>' +
        '<textarea id="counselingConcern" class="counseling-textarea" placeholder="' + placeholder + '"></textarea>' +
      '</div>' +

      /* 전송 데이터 미리보기 */
      '<details id="counselingPreview" class="preview-section">' +
        '<summary>📋 전송 데이터 미리보기 (개인정보 제외)</summary>' +
        '<pre id="counselingPreviewBody">학생을 선택하고 고민을 입력하면 미리보기가 표시됩니다.</pre>' +
      '</details>' +

      /* 버튼 */
      '<button id="counselingSubmitBtn" class="counseling-submit-btn" type="button">AI 상담 전략 받기</button>' +

      /* 오류 메시지 영역 */
      '<div id="counselingError" class="counseling-error hidden"></div>' +

      /* 로딩 영역 */
      '<div id="counselingLoading" class="counseling-loading hidden">AI가 상담 전략을 생성하는 중입니다…</div>' +

      /* 결과 영역 */
      '<div id="counselingResult" class="counseling-result hidden"></div>' +

      /* 안내 문구 */
      '<p class="counseling-disclaimer">' +
        'AI 상담 전략은 참고용입니다. 최종 판단과 실제 상담은 교사가 학생의 상황을 종합적으로 고려하여 진행해야 합니다.' +
      '</p>' +

    '</div>' +
  '</section>';
}

/**
 * 학생 카드의 "상담 전략 요청" 버튼 클릭 시 호출.
 * 패널에 선택된 학생 정보를 표시하고 미리보기를 갱신한다.
 */
function selectStudentForCounseling(student) {
  selectedCounselingStudent = student;

  var alias = STUDENT_ALIAS_MAP[student.id];
  var infoEl = document.querySelector("#counselingStudentInfo");
  if (infoEl) {
    infoEl.innerHTML =
      '<p class="selected-student-label">선택된 학생</p>' +
      '<p><strong>' + student.name + '</strong> (학번 ' + student.id + ') — 화면 표시용</p>' +
      '<p>Gemini 전송 시 별칭: <strong>' + alias + '</strong> (이름·학번·사진 경로 미전송)</p>';
  }

  /* 이전 결과/오류 초기화 */
  hideElement("#counselingResult");
  hideElement("#counselingError");
  hideElement("#counselingLoading");

  updatePreview();

  /* 패널로 스크롤 */
  var panel = document.querySelector(".counseling-panel");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * 교사 고민 textarea 입력 시 전송 데이터 미리보기를 갱신한다.
 */
function updatePreview() {
  var previewBody = document.querySelector("#counselingPreviewBody");
  if (!previewBody) return;

  if (!selectedCounselingStudent) {
    previewBody.textContent = "학생을 선택하고 고민을 입력하면 미리보기가 표시됩니다.";
    return;
  }

  var payload = buildPayload();
  previewBody.textContent = JSON.stringify(payload, null, 2);
}

/**
 * 전송할 JSON 페이로드를 조립한다.
 * 이름, 학번, 사진 경로, 비밀번호를 포함하지 않는다.
 */
function buildPayload() {
  if (!selectedCounselingStudent) return null;

  var student = selectedCounselingStudent;
  var alias = STUDENT_ALIAS_MAP[student.id];
  var concern = (document.querySelector("#counselingConcern") || {}).value || "";

  /* 성적 요약: "정보 수행평가: A, 웹앱 프로젝트: 92점, …" 형태 */
  var gradeSummary = Object.entries(student.grades)
    .map(function (entry) { return entry[0] + ": " + entry[1]; })
    .join(", ");

  /* 학습 특성 요약: traits + teacherMemo */
  var learningTraits = student.traits.join(" / ") + " / 교사 메모: " + student.teacherMemo;

  return {
    studentAlias: alias,
    gradeSummary: gradeSummary,
    learningTraits: learningTraits,
    teacherConcern: concern,
  };
}

/**
 * "AI 상담 전략 받기" 버튼 클릭 핸들러.
 * /api/gemini-counseling 으로 POST 요청을 보낸다.
 * 프론트엔드 코드에는 Gemini API 키가 절대 들어가지 않는다.
 */
async function handleCounselingSubmit() {
  /* 학생 미선택 */
  if (!selectedCounselingStudent) {
    showCounselingError("학생을 먼저 선택해주세요. 위 카드에서 '상담 전략 요청' 버튼을 눌러주세요.");
    return;
  }

  /* 교사 고민 미입력 */
  var concern = (document.querySelector("#counselingConcern") || {}).value || "";
  if (!concern.trim()) {
    showCounselingError("상담 고민을 먼저 입력해주세요.");
    return;
  }

  var payload = buildPayload();

  /* UI 상태: 로딩 */
  hideElement("#counselingResult");
  hideElement("#counselingError");
  showElement("#counselingLoading");

  var submitBtn = document.querySelector("#counselingSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;

  try {
    var response = await fetch("/api/gemini-counseling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    var data = await response.json();

    hideElement("#counselingLoading");

    if (data.success) {
      showCounselingResult(data.result);
    } else {
      showCounselingError(
        "AI 상담 전략을 불러오지 못했습니다. API 키 또는 Vercel 환경 변수를 확인해주세요.\n상세: " +
        (data.error || "알 수 없는 오류")
      );
    }
  } catch (err) {
    hideElement("#counselingLoading");
    showCounselingError(
      "AI 상담 전략을 불러오지 못했습니다. API 키 또는 Vercel 환경 변수를 확인해주세요.\n상세: " +
      err.message
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * 마크다운 형태의 Gemini 응답을 간단히 HTML로 변환하여 결과 영역에 표시한다.
 */
function showCounselingResult(text) {
  var resultEl = document.querySelector("#counselingResult");
  if (!resultEl) return;

  /* 간단한 마크다운 → HTML 변환 (## 제목, **굵게**, 줄바꿈) */
  var html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  resultEl.innerHTML = html;
  resultEl.classList.remove("hidden");
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showCounselingError(msg) {
  var el = document.querySelector("#counselingError");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideElement(selector) {
  var el = document.querySelector(selector);
  if (el) el.classList.add("hidden");
}

function showElement(selector) {
  var el = document.querySelector(selector);
  if (el) el.classList.remove("hidden");
}

showOnly(loginView);
