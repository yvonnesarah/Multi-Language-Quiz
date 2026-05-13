let score = 0;
let totalQuestions = 0;
let currentIndex = 0;

let questionsData = [];
let userAnswers = [];

let timer;
let timeLeft = 15;

let playerName = "Guest";
let isPaused = false;

/* PAGE SWITCH */
function showPage(page) {
  $("#homePage, #quizPage, #resultsPage").addClass("d-none");
  $(`#${page}`).removeClass("d-none");
}

/* CHECK ANSWERED */
function isAnswered(index) {
  return userAnswers[index] !== undefined;
}

/* INIT */
$(document).ready(function () {

  $("#startBtn").click(loadQuiz);
  $("#nextBtn").click(nextQuestion);
  $("#prevBtn").click(prevQuestion);
  $("#restartBtn").click(loadQuiz);
  $("#homeBtn").click(goHome);

  $("#pauseBtn").click(togglePause);

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

  /* RESUME */
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
function renderQuestion() {

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
        confetti({ particleCount: 120, spread: 80 });
      } else {
        showToast("❌ Wrong!", "wrong");
      }

      lockAnswer(card);
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

    if (isPaused) return;

    timeLeft--;

    $("#timerText").text(`⏱️ ${timeLeft}s`);
    $("#timerBarFill").css("width", `${(timeLeft / 15) * 100}%`);

    if (timeLeft <= 0) {
      clearInterval(timer);

      // AUTO MARK IF NOT ANSWERED
      if (!isAnswered(currentIndex)) {
        userAnswers[currentIndex] = {
          question: questionsData[currentIndex].question,
          selected: "No Answer",
          correct: questionsData[currentIndex].correct_answer
        };

        showToast("⏰ Time's up!", "wrong");
      }

      nextQuestion();
    }

  }, 1000);
}

/* PAUSE */
function togglePause() {
  isPaused = !isPaused;

  if (isPaused) {
    clearInterval(timer);
    $("#pauseBtn").text("▶ Resume");
  } else {
    $("#pauseBtn").text("⏸ Pause");
    startTimer();
  }
}

/* NAVIGATION */
function nextQuestion() {

  if (!isAnswered(currentIndex)) {
    showToast("⚠ Please answer before continuing!", "wrong");
    return;
  }

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

  $("#statsBox").html(`
    <div class="row text-center">
      <div class="col"><h3>${score}</h3><p>Correct</p></div>
      <div class="col"><h3>${totalQuestions - score}</h3><p>Wrong</p></div>
      <div class="col"><h3>${accuracy}%</h3><p>Accuracy</p></div>
    </div>
  `);

  renderReview();
  renderLeaderboard();
}

/* REVIEW */
function renderReview() {
  $("#reviewAnswers").html(
    userAnswers.map((a, i) => `
      <div class="review-card">
        <strong>Q${i + 1}:</strong> ${a.question}
        <br>
        <span class="text-success">✔ ${a.correct}</span><br>
        <span class="text-danger">✖ ${a.selected}</span>
      </div>
    `).join("")
  );
}

/* LEADERBOARD */
function renderLeaderboard() {

  let board = JSON.parse(localStorage.getItem("leaderboard")) || [];

  board.push({
    name: playerName,
    score,
    total: totalQuestions,
    percent: Math.round((score / totalQuestions) * 100),
    date: new Date().toLocaleString()
  });

  board.sort((a, b) => b.score - a.score);
  board = board.slice(0, 10);

  localStorage.setItem("leaderboard", JSON.stringify(board));

  const medals = ["🥇", "🥈", "🥉"];

  $("#leaderboard").html(`
    <div class="d-flex justify-content-between align-items-center mt-4 mb-3">
      <h5 class="mb-0">🏆 Leaderboard</h5>
      <button id="clearLeaderboard" class="btn btn-sm btn-danger">🗑 Clear</button>
    </div>

    <div class="list-group">

      ${board.map((b, i) => `
        <div class="list-group-item d-flex justify-content-between align-items-center">

          <div class="text-start">
            <div class="fw-bold">
              ${medals[i] || `#${i + 1}`} ${b.name}
            </div>
            <small class="text-muted">${b.date}</small>
          </div>

          <div class="text-center">
            <div class="fw-bold">${b.score}/${b.total}</div>
            <small>${b.percent}%</small>
          </div>

          <button class="btn btn-sm btn-outline-danger remove-entry" data-index="${i}">
            ✖
          </button>

        </div>
      `).join("")}

    </div>
  `);

  /* REMOVE ONE */
  $(".remove-entry").click(function () {
    let board = JSON.parse(localStorage.getItem("leaderboard")) || [];
    board.splice($(this).data("index"), 1);
    localStorage.setItem("leaderboard", JSON.stringify(board));
    renderLeaderboard();
  });

  /* CLEAR ALL */
  $("#clearLeaderboard").click(function () {
    if (confirm("Clear leaderboard?")) {
      localStorage.removeItem("leaderboard");
      $("#leaderboard").html("<p class='text-muted'>No scores yet</p>");
    }
  });
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

function lockAnswer(card) {
  setTimeout(() => {
    card.find("button").prop("disabled", true);
  }, 200);
}