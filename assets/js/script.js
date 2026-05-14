/* =========================
   QUIZ GAME STATE VARIABLES
   (Global state used across the app)
========================= */

let score = 0;              // Current correct answers
let totalQuestions = 0;     // Total questions in quiz
let currentIndex = 0;       // Current question index

let questionsData = [];     // API-loaded questions
let userAnswers = [];       // Stores user responses

let timer;                 // Interval reference for countdown
let timeLeft = 15;         // Time per question (seconds)

let playerName = "Guest";  // Player name from input
let isPaused = false;      // Pause state flag
let fiftyUsed = false;     // 50/50 lifeline flag (unused fully yet)


/* =========================
        PAGE SWITCHING
   Handles navigation between UI pages
========================= */

function showPage(page) {
  $("#homePage, #quizPage, #resultsPage, #leaderboardPage")
    .addClass("d-none");

  $(`#${page}`).removeClass("d-none");
}

/* =========================
       UTIL: DECODE TEXT
   Safely decodes API text
========================= */

function decodeText(str) {
  if (!str) return "";
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
}


/* =========================
   UTIL: SHUFFLE ARRAY
   Fisher-Yates shuffle algorithm
========================= */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/* =========================
        INIT (DOM READY)
   Setup event listeners and theme
========================= */

$(document).ready(function () {

  // =========================
// LEADERBOARD NAVIGATION 
// =========================

$("#viewLeaderboardBtn").click(function () {
  renderLeaderboardOnly();
  showPage("leaderboardPage");
});

$("#leaderboardBtn").click(function () {
  renderLeaderboardOnly();
  showPage("leaderboardPage");
});

$("#leaderboardHomeBtn").click(function () {
  showPage("homePage");
});

  // Start quiz
  $("#startBtn").click(loadQuiz);

  // Navigation buttons
  $("#nextBtn").click(nextQuestion);
  $("#prevBtn").click(prevQuestion);
  $("#restartBtn").click(loadQuiz);
  $("#homeBtn").click(goHome);

  // Pause/resume quiz
  $("#pauseBtn").click(togglePause);

  // Load saved theme preference
  if (localStorage.getItem("theme") === "light") {
    $("body").addClass("light-mode");
  }

  // Toggle light/dark mode
  $("#themeToggle").click(function () {
    $("body").toggleClass("light-mode");
    localStorage.setItem(
      "theme",
      $("body").hasClass("light-mode") ? "light" : "dark"
    );
  });


  /* =========================
     50/50 LIFELINE FEATURE
     Removes 2 wrong answers
  ========================= */

  $("#fiftyBtn").click(function () {

  const correct = $(".correct-answer-holder").data("correct");

  const buttons = $(".option-btn").toArray();

  const wrongButtons = buttons.filter(btn =>
    $(btn).data("answer") !== correct
  );

  shuffle(wrongButtons)
    .slice(0, 2)
    .forEach(btn => $(btn).fadeOut(200));

  $(this).prop("disabled", true);
});

});


/* =========================
         NAVIGATION
   Return to home screen
========================= */

function goHome() {
  clearInterval(timer); // stop timer
  showPage("homePage");
}


/* =========================
         LOAD QUIZ
   Fetch questions from API
========================= */

async function loadQuiz() {

  clearInterval(timer);
  isPaused = false;

  $("#pauseBtn").text("⏸ Pause");

  // Reset game state
  score = 0;
  currentIndex = 0;
  userAnswers = [];

  // Get player name
  playerName = $("#playerName").val().trim() || "Guest";

  showPage("quizPage");
  $("#loader").removeClass("d-none");

  // Get settings
  const category = $("#category").val();
  const difficulty = $("#difficulty").val();
  const amount = $("#questionCount").val();
  const language = $("#language").val() || "en";

  // OpenTDB API request
  let url = `https://opentdb.com/api.php?amount=${amount}&category=${category}&difficulty=${difficulty}&type=multiple`;

  const data = await $.getJSON(url);

  questionsData = data.results;
  totalQuestions = questionsData.length;

  $("#loader").addClass("d-none");

  // Render first question
  renderQuestion();
}


/* =========================
       RENDER QUESTION
   Displays current question + options
========================= */

async function renderQuestion() {

  const q = questionsData[currentIndex];
  const lang = $("#language").val() || "en";

  // Translate question & answers
  const translatedQuestion = await translateText(q.question, lang);
  const translatedCorrect = await translateText(q.correct_answer, lang);

  const translatedIncorrect = await Promise.all(
    q.incorrect_answers.map(ans => translateText(ans, lang))
  );

  // Shuffle all options
  const options = shuffle([translatedCorrect, ...translatedIncorrect]);

  // Build question card
  const card = $(`
    <div class="question-card ${q.difficulty}">
      <h5>${translatedQuestion}</h5>
      <div class="options"></div>

      <!-- hidden correct answer holder -->
      <div class="correct-answer-holder d-none"
           data-correct="${translatedCorrect}">
      </div>
    </div>
  `);

  // Create answer buttons
  options.forEach(option => {

    const btn = $(`
      <button class="btn btn-light option-btn">
        ${option}
      </button>
    `);

    // Handle answer click
    btn.click(function () {

      // Prevent multiple answers
      if (userAnswers[currentIndex]) return;

      const isCorrect = option === translatedCorrect;

      // Save answer
      userAnswers[currentIndex] = {
        question: q.question,
        selected: option,
        correct: translatedCorrect
      };

      // Score handling
      if (isCorrect) {
        score++;
        showToast("✅ Correct!", "correct");
        confetti({ particleCount: 100, spread: 70 });
      } else {
        showToast("❌ Wrong!", "wrong");
      }

      lockAnswer(card);
      updateScore();
    });

    card.find(".options").append(btn);
  });

  $("#quizBox").html(card);

  updateProgress();
  updateScore();
  startTimer();
}


/* =========================
            TIMER
   Countdown logic per question
========================= */

function startTimer() {
  clearInterval(timer);
  timeLeft = 15;

  timer = setInterval(() => {

  if (isPaused) return;

  if ($("#quizPage").hasClass("d-none")) {
    clearInterval(timer);
    return;
  }

  timeLeft--;

    $("#timerText").text(`⏱️ ${timeLeft}s`);
    $("#timerBarFill").css("width", `${(timeLeft / 15) * 100}%`);

    // Time up handling
    if (timeLeft <= 0) {
      clearInterval(timer);

      // Auto-save unanswered
      if (!userAnswers[currentIndex]) {
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


/* =========================
          PAUSE
   Toggle quiz pause/resume
========================= */

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


/* =========================
     QUESTION NAVIGATION
========================= */

function nextQuestion() {

  // Must answer before moving on
  if (!userAnswers[currentIndex] || userAnswers[currentIndex].selected === undefined) {
    showToast("⚠ Please answer first!", "wrong");
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


/* =========================
         RESULTS SCREEN
========================= */

function showResults() {

  clearInterval(timer);
  showPage("resultsPage");

  const accuracy = Math.round((score / totalQuestions) * 100);

  // Final score summary
  $("#finalScore").html(`
    <h4>${playerName}</h4>
    <h2>${score} / ${totalQuestions}</h2>
    <p>Accuracy: ${accuracy}%</p>
  `);

  // Stats breakdown
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


/* =========================
        ANSWER REVIEW
========================= */

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


/* =========================
        LEADERBOARD
   Stored in localStorage
========================= */

function renderLeaderboard() {

  let board = JSON.parse(localStorage.getItem("leaderboard")) || [];

  const resultId = Date.now();

  // Add current result
 
board.push({
  id: resultId,
  name: playerName,
  score,
  total: totalQuestions,
  percent: Math.round((score / totalQuestions) * 100),
  date: new Date().toLocaleString()
});

  // Sort by score
  board.sort((a, b) => b.score - a.score);

  // Keep top 10
  board = board.slice(0, 10);

  localStorage.setItem("leaderboard", JSON.stringify(board));

  const medals = ["🥇", "🥈", "🥉"];

  $("#leaderboard").html(`
    <h5>🏆 Leaderboard</h5>

    <div class="list-group">
      ${board.map((b, i) => `
        <div class="list-group-item d-flex justify-content-between align-items-center">

          <div>
            ${medals[i] || i + 1} ${b.name}
            <br>
            <small>${b.score}/${b.total}</small>
          </div>

          <button 
            class="btn btn-sm btn-danger remove-score"
            data-index="${i}"
          >
            ❌ Remove
          </button>

        </div>
      `).join("")}
    </div>
  `);

  /* =========================
       REMOVE SCORE BUTTON
  ========================= */

  $(".remove-score").click(function () {

    const index = $(this).data("index");

    let updatedBoard =
      JSON.parse(localStorage.getItem("leaderboard")) || [];

    // Remove selected item
    updatedBoard.splice(index, 1);

    // Save updated board
    localStorage.setItem(
      "leaderboard",
      JSON.stringify(updatedBoard)
    );

    // Re-render leaderboard
    $("#leaderboard").html("");
    renderLeaderboardOnly();
  });
}


/* =========================
    RENDER ONLY EXISTING
      LEADERBOARD DATA
========================= */

function renderLeaderboardOnly() {

  let board =
    JSON.parse(localStorage.getItem("leaderboard")) || [];

  // EMPTY LEADERBOARD MESSAGE
 if (!board || board.length === 0) {
  $("#leaderboard").html(`
    <h5>🏆 Leaderboard</h5>
    <div class="empty-board text-center p-4">
      <h6>No scores yet</h6>
    </div>
  `);
  return;
}

  const medals = ["🥇", "🥈", "🥉"];

  $("#leaderboard").html(`
    <h5>🏆 Leaderboard</h5>

    <div class="list-group">
      ${board.map((b, i) => `
        <div class="list-group-item d-flex justify-content-between align-items-center">

          <div>
            ${medals[i] || i + 1} ${b.name}
            <br>
            <small>${b.score}/${b.total}</small>
          </div>

          <button 
            class="btn btn-sm btn-danger remove-score"
            data-index="${i}"
          >
            ❌ Remove
          </button>

        </div>
      `).join("")}
    </div>
  `);

  // Re-bind remove buttons
  $(".remove-score").click(function () {

    const index = $(this).data("index");

    let updatedBoard =
      JSON.parse(localStorage.getItem("leaderboard")) || [];

    updatedBoard.splice(index, 1);

    localStorage.setItem(
      "leaderboard",
      JSON.stringify(updatedBoard)
    );

    renderLeaderboardOnly();
  });
}


/* =========================
     TRANSLATION API
   Uses MyMemory API
========================= */

async function translateText(text, targetLang) {
  if (!text || targetLang === "en") return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    const res = await $.getJSON(url);

    return res.responseData.translatedText || text;
  } catch (err) {
    return text;
  }
}


/* =========================
       UI HELPERS
========================= */

function updateProgress() {
  const percent = ((currentIndex + 1) / totalQuestions) * 100;
  $("#progressBar").css("width", percent + "%");
  $("#progressText").text(`Q ${currentIndex + 1} / ${totalQuestions}`);
}

function updateScore() {
  $("#scoreBox").text(`Score: ${score}/${totalQuestions}`);
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
  }, 150);
}