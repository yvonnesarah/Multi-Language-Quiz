let score = 0;
let totalQuestions = 0;
let quizLocked = false;

let currentIndex = 0;
let questionsData = [];
let userAnswers = [];

let timer;
let timeLeft = 15;

/* ================= PAGE SWITCH ================= */
function showPage(page) {
  $("#homePage, #quizPage, #resultsPage").addClass("d-none");
  $(`#${page}`).removeClass("d-none");
}

/* ================= INIT ================= */
$(document).ready(function () {
  $("#startBtn").click(loadQuiz);
  $("#nextBtn").click(nextQuestion);
  $("#prevBtn").click(prevQuestion);
  $("#restartBtn").click(loadQuiz);
  $("#homeBtn").click(goHome);
});

/* ================= HOME ================= */
function goHome() {
  quizLocked = false;
  clearInterval(timer);
  showPage("homePage");
}

/* ================= LOADING ================= */
function setLoading(state) {
  $("#loader").toggleClass("d-none", !state);
}

/* ================= UTILS ================= */
function decodeHTML(html) {
  return $("<textarea>").html(html).text();
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/* ================= TRANSLATE ================= */
async function translate(text, lang) {
  if (lang === "en") return text;

  try {
    const res = await $.ajax({
      url: "https://api.mymemory.translated.net/get",
      data: { q: text, langpair: `en|${lang}` }
    });

    return res?.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

/* ================= TIMER ================= */
function startTimer() {
  clearInterval(timer);
  timeLeft = 15;

  $("#timerText").text(`⏱️ ${timeLeft}s`);

  timer = setInterval(() => {
    timeLeft--;
    $("#timerText").text(`⏱️ ${timeLeft}s`);

    if (timeLeft <= 0) {
      clearInterval(timer);
      lockAnswer();
      nextQuestion();
    }
  }, 1000);
}

/* ================= PROGRESS ================= */
function updateProgress() {
  let percent = ((currentIndex + 1) / totalQuestions) * 100;
  $("#progressBar").css("width", percent + "%");
  $("#progressText").text(`Question ${currentIndex + 1} / ${totalQuestions}`);
}

/* ================= LOAD QUIZ ================= */
async function loadQuiz() {

  showPage("quizPage");

  quizLocked = true;
  score = 0;
  currentIndex = 0;
  userAnswers = [];

  $("#quizBox").html("");
  $("#scoreBox").html("");

  setLoading(true);

  const category = $("#category").val();
  const difficulty = $("#difficulty").val();

  const data = await $.getJSON(
    `https://opentdb.com/api.php?amount=5&category=${category}&difficulty=${difficulty}&type=multiple`
  );

  questionsData = data.results || [];
  totalQuestions = questionsData.length;

  setLoading(false);

  renderQuestion();
}

/* ================= RENDER QUESTION ================= */
async function renderQuestion() {

  $("#quizBox").html("");

  const q = questionsData[currentIndex];

  const questionText = decodeHTML(q.question);
  const translatedQ = await translate(questionText, $("#language").val());

  const correct = await translate(decodeHTML(q.correct_answer), $("#language").val());

  const incorrect = await Promise.all(
    q.incorrect_answers.map(a =>
      translate(decodeHTML(a), $("#language").val())
    )
  );

  const options = shuffle([correct, ...incorrect]);

  const card = $(`
    <div class="question-card">
      <div class="fw-bold mb-2">${translatedQ}</div>
      <div class="options"></div>
    </div>
  `);

  options.forEach(option => {

    const btn = $(`<button class="btn btn-light option-btn">${option}</button>`);

    btn.click(function () {

      if (userAnswers[currentIndex]) return;

      userAnswers[currentIndex] = option;

      if (option === correct) score++;

      lockAnswer(card, correct);
      updateScore();
    });

    card.find(".options").append(btn);
  });

  $("#quizBox").append(card);

  updateProgress();
  startTimer();
  updateScore();
}

/* ================= LOCK ANSWER ================= */
function lockAnswer(card = $(".question-card"), correct = null) {

  const q = questionsData[currentIndex];
  correct = correct || q.correct_answer;

  card.find("button").each(function () {

    $(this).prop("disabled", true);

    if ($(this).text() === correct) {
      $(this).addClass("correct");
    }

    if (userAnswers[currentIndex] === $(this).text() &&
        $(this).text() !== correct) {
      $(this).addClass("wrong");
    }
  });
}

/* ================= NAV ================= */
function nextQuestion() {
  if (currentIndex < totalQuestions - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    showResults();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

/* ================= SCORE ================= */
function updateScore() {
  $("#scoreBox").text(`Score: ${score} / ${totalQuestions}`);
}

/* ================= RESULTS ================= */
function showResults() {

  clearInterval(timer);

  showPage("resultsPage");

  let best = localStorage.getItem("bestScore") || 0;

  if (score > best) {
    localStorage.setItem("bestScore", score);
    best = score;
  }

  $("#finalScore").html(`Your Score: <b>${score} / ${totalQuestions}</b>`);
  $("#bestScore").html(`🏆 Best Score: <b>${best}</b>`);
}