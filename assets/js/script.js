let score = 0;
let totalQuestions = 0;
let currentIndex = 0;

let questionsData = [];
let userAnswers = [];

let timer;
let timeLeft = 15;

let playerName = "Guest";

/* PAGE */
function showPage(page) {
  $("#homePage, #quizPage, #resultsPage").addClass("d-none");
  $(`#${page}`).removeClass("d-none");
}

/* INIT */
$(document).ready(function () {

  $("#startBtn").click(loadQuiz);
  $("#nextBtn").click(nextQuestion);
  $("#prevBtn").click(prevQuestion);
  $("#restartBtn").click(loadQuiz);
  $("#homeBtn").click(goHome);

  /* THEME */
  if (localStorage.getItem("theme") === "light") {
    $("body").addClass("light-mode");
  }

  $("#themeToggle").click(function () {
    $("body").toggleClass("light-mode");
    localStorage.setItem(
      "theme",
      $("body").hasClass("light-mode") ? "light" : "dark"
    );
  });

  /* RESUME QUIZ */
  const saved = JSON.parse(localStorage.getItem("quizProgress"));

  if (saved) {
    setTimeout(() => {
      if (confirm("Resume previous quiz?")) {
        currentIndex = saved.currentIndex;
        score = saved.score;
        userAnswers = saved.userAnswers;
        questionsData = saved.questionsData;
        totalQuestions = questionsData.length;

        showPage("quizPage");
        renderQuestion();
      }
    }, 500);
  }
});

/* HOME */
function goHome() {
  clearInterval(timer);
  showPage("homePage");
}

/* LOAD QUIZ */
async function loadQuiz() {

  score = 0;
  currentIndex = 0;
  userAnswers = [];

  playerName = $("#playerName").val().trim() || "Guest";

  showPage("quizPage");
  $("#loader").removeClass("d-none");

  const category = $("#category").val();
  const difficulty = $("#difficulty").val();
  const amount = $("#questionCount").val();

  const data = await $.getJSON(
    `https://opentdb.com/api.php?amount=${amount}&category=${category}&difficulty=${difficulty}&type=multiple`
  );

  questionsData = data.results;
  totalQuestions = questionsData.length;

  $("#loader").addClass("d-none");

  saveProgress();
  renderQuestion();
}

/* QUESTION */
async function renderQuestion() {

  const q = questionsData[currentIndex];

  const options = shuffle([
    q.correct_answer,
    ...q.incorrect_answers
  ]);

  const card = $(`
    <div class="question-card ${q.difficulty}">
      <h5>${q.question}</h5>
      <div class="options"></div>
    </div>
  `);

  options.forEach(option => {

    const btn = $(`
      <button class="btn btn-light option-btn">
        ${option}
      </button>
    `);

    btn.click(function () {

      if (userAnswers[currentIndex]) return;

      const isCorrect = option === q.correct_answer;

      userAnswers[currentIndex] = {
        question: q.question,
        selected: option,
        correct: q.correct_answer
      };

      if (isCorrect) {
        score++;
        showToast("✅ Correct!", "correct");
        vibrate("correct");
        confetti({ particleCount: 120, spread: 80 });
      } else {
        showToast("❌ Wrong!", "wrong");
        vibrate("wrong");
      }

      lockAnswer(card, q.correct_answer);
      updateScore();
      saveProgress();
    });

    card.find(".options").append(btn);
  });

  $("#quizBox").html(card);
  updateProgress();
  updateScore();
  startTimer();
}

/* TIMER */
function startTimer() {
  clearInterval(timer);
  timeLeft = 15;

  timer = setInterval(() => {

    timeLeft--;

    $("#timerText").text(`⏱️ ${timeLeft}s`);

    $("#timerBarFill").css("width", `${(timeLeft / 15) * 100}%`);

    if (timeLeft <= 0) {
      clearInterval(timer);
      nextQuestion();
    }

  }, 1000);
}

/* NAV */
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

/* RESULTS */
function showResults() {

  clearInterval(timer);
  localStorage.removeItem("quizProgress");

  showPage("resultsPage");

  const accuracy = Math.round((score / totalQuestions) * 100);

  $("#finalScore").html(`
    <h4>${playerName}</h4>
    <h2>${score} / ${totalQuestions}</h2>
    <p>Accuracy: ${accuracy}%</p>
  `);

  const correct = score;
  const wrong = totalQuestions - score;

  $("#statsBox").html(`
    <div class="row text-center">
      <div class="col"><h3>${correct}</h3><p>Correct</p></div>
      <div class="col"><h3>${wrong}</h3><p>Wrong</p></div>
      <div class="col"><h3>${accuracy}%</h3><p>Accuracy</p></div>
    </div>
  `);
}

/* UTIL */
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

function updateProgress() {
  const percent = ((currentIndex + 1) / totalQuestions) * 100;
  $("#progressBar").css("width", percent + "%");
  $("#progressText").text(`Question ${currentIndex + 1} / ${totalQuestions}`);
}

function updateScore() {
  $("#scoreBox").text(`Score: ${score}/${totalQuestions}`);
}

function saveProgress() {
  localStorage.setItem("quizProgress", JSON.stringify({
    currentIndex,
    score,
    userAnswers,
    questionsData
  }));
}

function showToast(msg, type) {
  $("#toast")
    .removeClass()
    .addClass(`toast-message toast-${type} toast-show`)
    .text(msg);

  setTimeout(() => $("#toast").removeClass("toast-show"), 1500);
}

function vibrate(type) {
  if (!navigator.vibrate) return;
  navigator.vibrate(type === "correct" ? [80, 30, 80] : [200]);
}

function lockAnswer(card, correct) {
  setTimeout(() => {
    card.find("button").prop("disabled", true);
  }, 200);
}