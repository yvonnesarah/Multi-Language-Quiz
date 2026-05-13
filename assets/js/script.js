/* =========================
   QUIZ GAME STATE VARIABLES
   (Global state for quiz logic)
========================= */

let score = 0;                // Tracks correct answers
let totalQuestions = 0;       // Total number of questions in quiz
let currentIndex = 0;         // Current question index being shown

let questionsData = [];       // Stores fetched quiz questions from API
let userAnswers = [];         // Stores user responses per question

let timer;                    // Holds interval reference for countdown
let timeLeft = 15;            // Countdown timer per question (seconds)

let playerName = "Guest";     // Player name from input field
let isPaused = false;         // Tracks pause/resume state
let fiftyUsed = false;        // Tracks if 50/50 lifeline has been used


/* =========================
        PAGE SWITCHING
   (Controls UI navigation)
========================= */

// Shows only the selected page and hides others
function showPage(page) {
  $("#homePage, #quizPage, #resultsPage").addClass("d-none");
  $(`#${page}`).removeClass("d-none");
}


/* =========================
       ANSWER HELPERS
   (Utility functions for answers)
========================= */

// Checks if current question has already been answered
function isAnswered(index) {
  return userAnswers[index] !== undefined;
}

/* Decodes HTML entities returned from OpenTDB API */
function decodeHTML(str) {
  return $("<div>").html(str).text().trim();
}


/* =========================
        INITIALIZATION
   (Runs when DOM is ready)
========================= */

$(document).ready(function () {

  // Bind main button events
  $("#startBtn").click(loadQuiz);
  $("#nextBtn").click(nextQuestion);
  $("#prevBtn").click(prevQuestion);
  $("#restartBtn").click(loadQuiz);
  $("#homeBtn").click(goHome);
  $("#pauseBtn").click(togglePause);

  /* =========================
            THEME SYSTEM
     (Dark/Light mode toggle)
  ========================= */

  // Load saved theme from localStorage
  if (localStorage.getItem("theme") === "light") {
    $("body").addClass("light-mode");
  }

  // Toggle theme and persist preference
  $("#themeToggle").click(function () {
    $("body").toggleClass("light-mode");

    localStorage.setItem(
      "theme",
      $("body").hasClass("light-mode") ? "light" : "dark"
    );
  });


  /* =========================
        50/50 LIFELINE
     (Removes 2 incorrect options)
  ========================= */

  $("#fiftyBtn").click(function () {

    const q = questionsData[currentIndex];          // current question
    const buttons = $(".option-btn").toArray();     // all answer buttons

    const correct = decodeHTML(q.correct_answer);   // correct answer text

    // Filter out wrong answer buttons
    const wrongButtons = buttons.filter(btn => {
      return decodeHTML($(btn).html()) !== correct;
    });

    // Randomly hide two wrong answers
    shuffle(wrongButtons)
      .slice(0, 2)
      .forEach(btn => $(btn).fadeOut(200));

    // Disable lifeline after use
    $(this).prop("disabled", true);
  });

});


/* =========================
         NAVIGATION
   (Back to home screen)
========================= */

function goHome() {
  clearInterval(timer);   // stop timer
  showPage("homePage");   // switch UI
}


/* =========================
         LOAD QUIZ
   (Fetch questions from API)
========================= */

async function loadQuiz() {

  // Reset game state
  score = 0;
  currentIndex = 0;
  userAnswers = [];
  fiftyUsed = false;

  // Get player name or default
  playerName = $("#playerName").val().trim() || "Guest";

  showPage("quizPage");
  $("#loader").removeClass("d-none");

  // Get quiz settings from UI
  const category = $("#category").val();
  const difficulty = $("#difficulty").val();
  const amount = $("#questionCount").val();

  // Fetch questions from OpenTDB API
  const data = await $.getJSON(
    `https://opentdb.com/api.php?amount=${amount}&category=${category}&difficulty=${difficulty}&type=multiple`
  );

  questionsData = data.results;
  totalQuestions = questionsData.length;

  $("#loader").addClass("d-none");

  renderQuestion();
}


/* =========================
       RENDER QUESTION
   (Builds UI for each question)
========================= */

function renderQuestion() {

  const q = questionsData[currentIndex];

  // Combine correct + incorrect answers and shuffle
  const options = shuffle([
    q.correct_answer,
    ...q.incorrect_answers
  ]);

  // Create question container
  const card = $(`
    <div class="question-card ${q.difficulty}">
      <h5>${q.question}</h5>
      <div class="options"></div>
    </div>
  `);

  // Create answer buttons
  options.forEach(option => {

    const btn = $(`
      <button class="btn btn-light option-btn">
        ${option}
      </button>
    `);

    // Handle answer selection
    btn.click(function () {

      // Prevent multiple answers
      if (userAnswers[currentIndex]) return;

      const isCorrect =
        decodeHTML(option) === decodeHTML(q.correct_answer);

      // Save user answer
      userAnswers[currentIndex] = {
        question: q.question,
        selected: option,
        correct: q.correct_answer
      };

      // Update score and show feedback
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
   (15 second countdown per question)
========================= */

function startTimer() {
  clearInterval(timer);
  timeLeft = 15;

  timer = setInterval(() => {

    if (isPaused) return;

    timeLeft--;

    $("#timerText").text(`⏱️ ${timeLeft}s`);
    $("#timerBarFill").css("width", `${(timeLeft / 15) * 100}%`);

    // If time runs out
    if (timeLeft <= 0) {
      clearInterval(timer);

      // Auto-save "No Answer"
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


/* =========================
          PAUSE
   (Pause / resume timer)
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

  // Require answer before moving forward
  if (!isAnswered(currentIndex)) {
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

// Go to previous question
function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}


/* =========================
           RESULTS
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

  // Detailed stats
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
========================= */

function renderLeaderboard() {

  let board = JSON.parse(localStorage.getItem("leaderboard")) || [];

  // Add current game result
  board.push({
    name: playerName,
    score,
    total: totalQuestions,
    percent: Math.round((score / totalQuestions) * 100),
    date: new Date().toLocaleString()
  });

  // Sort by score (descending)
  board.sort((a, b) => b.score - a.score);

  // Keep top 10 only
  board = board.slice(0, 10);

  localStorage.setItem("leaderboard", JSON.stringify(board));

  const medals = ["🥇", "🥈", "🥉"];

  $("#leaderboard").html(`
    <h5>🏆 Leaderboard</h5>
    <div class="list-group">
      ${board.map((b, i) => `
        <div class="list-group-item d-flex justify-content-between">
          <div>${medals[i] || i + 1} ${b.name}</div>
          <div>${b.score}/${b.total}</div>
        </div>
      `).join("")}
    </div>
  `);
}


/* =========================
         UTILITIES
========================= */

// Randomly shuffle array elements
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// Update progress bar UI
function updateProgress() {
  const percent = ((currentIndex + 1) / totalQuestions) * 100;
  $("#progressBar").css("width", percent + "%");
  $("#progressText").text(`Q ${currentIndex + 1} / ${totalQuestions}`);
}

// Update score display UI
function updateScore() {
  $("#scoreBox").text(`Score: ${score}/${totalQuestions}`);
}

// Show temporary toast message
function showToast(msg, type) {
  $("#toast")
    .removeClass()
    .addClass(`toast-message toast-${type} toast-show`)
    .text(msg);

  setTimeout(() => $("#toast").removeClass("toast-show"), 1500);
}

// Disable answer buttons after selection
function lockAnswer(card) {
  setTimeout(() => {
    card.find("button").prop("disabled", true);
  }, 150);
}