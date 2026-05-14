/* =========================
   QUIZ GAME STATE VARIABLES
   (Global state used across the app)
========================= */

// Bootstrap welcome modal instance
let welcomeModal;

// Tracks how many correct answers the player gets
let score = 0;

// Total number of quiz questions loaded from API
let totalQuestions = 0;

// Current question position in the quiz
let currentIndex = 0;

// Stores all questions fetched from the API
let questionsData = [];

// Stores user answers for review/results
let userAnswers = [];

// Reference for the countdown timer interval
let timer;

// Remaining seconds for current question
let timeLeft = 15;

// Player name entered on home screen
let playerName = "Guest";

// Determines whether quiz is paused
let isPaused = false;

// Prevents using the 50/50 lifeline multiple times
let fiftyUsed = false;


/* =========================
        PAGE SWITCHING
   Handles navigation between UI pages
========================= */

function showPage(page) {

  // Hide all application pages first
  $("#homePage, #quizPage, #resultsPage, #leaderboardPage")
    .addClass("d-none");

  // Show only the requested page
  $(`#${page}`).removeClass("d-none");
}


/* =========================
       UTIL: DECODE TEXT
   Safely decodes API text
========================= */

function decodeText(str) {

  // Return empty string if input is invalid
  if (!str) return "";

  try {

    // Decode URL-encoded characters
    return decodeURIComponent(str);

  } catch (e) {

    // Fallback to original string if decoding fails
    return str;
  }
}


/* =========================
   UTIL: SHUFFLE ARRAY
   Fisher-Yates shuffle algorithm
========================= */

function shuffle(arr) {

  // Clone array to avoid mutating original
  const a = [...arr];

  // Shuffle elements from end to beginning
  for (let i = a.length - 1; i > 0; i--) {

    // Pick random index
    const j = Math.floor(Math.random() * (i + 1));

    // Swap elements
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

/* =========================
        INIT (DOM READY)
   Setup event listeners and theme
========================= */

$(document).ready(function () {

  /* =========================
   INIT WELCOME MODAL
========================= */

welcomeModal = new bootstrap.Modal(
  document.getElementById("welcomeModal")
);

// Show modal on initial home page load
welcomeModal.show();

  /* =========================
   THEME INITIALIZATION
========================= */

// Load saved theme from localStorage
if (localStorage.getItem("theme") === "light") {

  $("body").addClass("light-mode");

}

/* =========================
   THEME TOGGLE
========================= */

$("#themeToggle").click(function () {

  // Toggle light mode class
  $("body").toggleClass("light-mode");

  // Save current theme
  const currentTheme =
    $("body").hasClass("light-mode")
      ? "light"
      : "dark";

  localStorage.setItem("theme", currentTheme);

});

  // =========================
  // LEADERBOARD NAVIGATION
  // =========================

  // Open leaderboard from home page
  $("#viewLeaderboardBtn").click(function () {
    renderLeaderboardOnly();
    showPage("leaderboardPage");
  });

  // Open leaderboard from results page
  $("#leaderboardBtn").click(function () {
    renderLeaderboardOnly();
    showPage("leaderboardPage");
  });

  // Return back to home page
$("#leaderboardHomeBtn").click(function () {

  // Return to homepage
  showPage("homePage");

  // Open modal
  welcomeModal.show();

});

  // Start quiz button
  $("#startBtn").click(loadQuiz);

  // Navigation buttons
  $("#nextBtn").click(nextQuestion);
  $("#prevBtn").click(prevQuestion);

  // Restart quiz
  $("#restartBtn").click(loadQuiz);

  // Return home
  $("#homeBtn").click(goHome);

  // Pause/resume button
  $("#pauseBtn").click(togglePause);


  /* =========================
     50/50 LIFELINE FEATURE
     Removes 2 wrong answers
  ========================= */

  $("#fiftyBtn").click(function () {

    // Get correct answer stored in hidden element
    const correct = $(".correct-answer-holder").data("correct");

    // Convert all answer buttons into array
    const buttons = $(".option-btn").toArray();

    // Filter only incorrect answers
    const wrongButtons = buttons.filter(btn =>
      $(btn).data("answer") !== correct
    );

    // Randomly hide 2 incorrect answers
    shuffle(wrongButtons)
      .slice(0, 2)
      .forEach(btn => $(btn).fadeOut(200));

    // Disable lifeline button after use
    $(this).prop("disabled", true);
  });

});


/* =========================
         NAVIGATION
   Return to home screen
========================= */

function goHome() {

  // Stop active timer
  clearInterval(timer);

  // Show home page
  showPage("homePage");

  // Show welcome modal again
  welcomeModal.show();
}

/* =========================
         LOAD QUIZ
   Fetch questions from API
========================= */

async function loadQuiz() {

  // Clear any previous timer
  clearInterval(timer);

  // Reset pause state
  isPaused = false;

  // Reset pause button text
  $("#pauseBtn").text("⏸ Pause");

  // Reset game values
  score = 0;
  currentIndex = 0;
  userAnswers = [];

  // Get player name or fallback to Guest
  playerName = $("#playerName").val().trim() || "Guest";

  // Switch to quiz page
  showPage("quizPage");

  // Show loading spinner
  $("#loader").removeClass("d-none");

  // Get quiz settings selected by user
  const category = $("#category").val();
  const difficulty = $("#difficulty").val();
  const amount = $("#questionCount").val();
  const language = $("#language").val() || "en";

  // Build OpenTDB API URL
  let url = `https://opentdb.com/api.php?amount=${amount}&category=${category}&difficulty=${difficulty}&type=multiple`;

  // Fetch quiz data
  const data = await $.getJSON(url);

  // Store questions globally
  questionsData = data.results;

  // Save total question count
  totalQuestions = questionsData.length;

  // Hide loader after fetching completes
  $("#loader").addClass("d-none");

  // Render first question
  renderQuestion();
}


/* =========================
       RENDER QUESTION
   Displays current question + options
========================= */

async function renderQuestion() {

  // Get current question object
  const q = questionsData[currentIndex];

  // Selected language
  const lang = $("#language").val() || "en";

  // Translate question text
  const translatedQuestion = await translateText(q.question, lang);

  // Translate correct answer
  const translatedCorrect = await translateText(q.correct_answer, lang);

  // Translate incorrect answers
  const translatedIncorrect = await Promise.all(
    q.incorrect_answers.map(ans => translateText(ans, lang))
  );

  // Shuffle all answer choices
  const options = shuffle([translatedCorrect, ...translatedIncorrect]);

  // Build question card UI
  const card = $(`
    <div class="question-card ${q.difficulty}">
      <h5>${translatedQuestion}</h5>
      <div class="options"></div>

      <div class="correct-answer-holder d-none"
           data-correct="${translatedCorrect}">
      </div>
    </div>
  `);

  // Generate answer buttons
  options.forEach(option => {

    const btn = $(`
      <button class="btn btn-light option-btn">
        ${option}
      </button>
    `);

    // Handle answer selection
    btn.click(function () {

      // Prevent answering twice
      if (userAnswers[currentIndex]) return;

      // Check correctness
      const isCorrect = option === translatedCorrect;

      // Store answer data
      userAnswers[currentIndex] = {
        question: translatedQuestion,
        selected: option,
        correct: translatedCorrect
      };

      // Correct answer handling
      if (isCorrect) {

        score++;

        showToast("✅ Correct!", "correct");

        // Trigger confetti animation
        confetti({
          particleCount: 100,
          spread: 70
        });

      } else {

        // Wrong answer feedback
        showToast("❌ Wrong!", "wrong");
      }

      // Disable buttons after answering
      lockAnswer(card);

      // Refresh score display
      updateScore();
    });

    // Add button to options container
    card.find(".options").append(btn);
  });

  // Render question inside quiz box
  $("#quizBox").html(card);

  // Update progress UI
  updateProgress();

  // Update score display
  updateScore();

  // Start countdown timer
  startTimer();
}


/* =========================
            TIMER
   Countdown logic per question
========================= */

function startTimer() {

  // Clear existing timer
  clearInterval(timer);

  // Reset timer value
  timeLeft = 15;

  // Start countdown
  timer = setInterval(() => {

    // Pause timer updates if quiz paused
    if (isPaused) return;

    // Stop timer if quiz page hidden
    if ($("#quizPage").hasClass("d-none")) {
      clearInterval(timer);
      return;
    }

    // Decrease remaining time
    timeLeft--;

    // Update timer text
    $("#timerText").text(`⏱️ ${timeLeft}s`);

    // Update progress bar width
    $("#timerBarFill").css(
      "width",
      `${(timeLeft / 15) * 100}%`
    );

    // Handle time expiration
    if (timeLeft <= 0) {

      clearInterval(timer);

      // Save unanswered question
      if (!userAnswers[currentIndex]) {

        userAnswers[currentIndex] = {
          question: $("#quizBox .question-card h5").text(),
          selected: "No Answer",
          correct: $(".correct-answer-holder").data("correct")
        };

        // Show timeout notification
        showToast("⏰ Time's up!", "wrong");
      }

      // Automatically move to next question
      nextQuestion();
    }

  }, 1000);
}


/* =========================
          PAUSE
   Toggle quiz pause/resume
========================= */

function togglePause() {

  // Toggle pause state
  isPaused = !isPaused;

  if (isPaused) {

    // Stop timer while paused
    clearInterval(timer);

    // Change button label
    $("#pauseBtn").text("▶ Resume");

  } else {

    // Restore button label
    $("#pauseBtn").text("⏸ Pause");

    // Restart timer
    startTimer();
  }
}


/* =========================
     QUESTION NAVIGATION
========================= */

function nextQuestion() {

  // Prevent moving forward without answer
  if (
    !userAnswers[currentIndex] ||
    userAnswers[currentIndex].selected === undefined
  ) {
    showToast("⚠ Please answer first!", "wrong");
    return;
  }

  // Move to next question if available
  if (currentIndex < totalQuestions - 1) {

    currentIndex++;
    renderQuestion();

  } else {

    // Show results at end of quiz
    showResults();
  }
}

function prevQuestion() {

  // Go back only if not first question
  if (currentIndex > 0) {

    currentIndex--;
    renderQuestion();
  }
}


/* =========================
         RESULTS SCREEN
========================= */

function showResults() {

  // Stop timer
  clearInterval(timer);

  // Open results page
  showPage("resultsPage");

  // Calculate accuracy percentage
  const accuracy =
    Math.round((score / totalQuestions) * 100);

  // Display final score summary
  $("#finalScore").html(`
    <h4>${playerName}</h4>
    <h2>${score} / ${totalQuestions}</h2>
    <p>Accuracy: ${accuracy}%</p>
  `);

  // Display detailed statistics
  $("#statsBox").html(`
    <div class="row text-center">
      <div class="col">
        <h3>${score}</h3>
        <p>Correct</p>
      </div>

      <div class="col">
        <h3>${totalQuestions - score}</h3>
        <p>Wrong</p>
      </div>

      <div class="col">
        <h3>${accuracy}%</h3>
        <p>Accuracy</p>
      </div>
    </div>
  `);

  // Render review and leaderboard
  renderReview();
  renderLeaderboard();
}


/* =========================
        ANSWER REVIEW
========================= */

function renderReview() {

  // Generate answer review cards
  $("#reviewAnswers").html(

    userAnswers.map((a, i) => `

      <div class="review-card">

        <strong>Q${i + 1}:</strong>
        ${a.question}

        <br>

        <span class="text-success">
          ✔ ${a.correct}
        </span>

        <br>

        <span class="text-danger">
          ✖ ${a.selected}
        </span>

      </div>

    `).join("")
  );
}


/* =========================
        LEADERBOARD
   Stored in localStorage
========================= */

function renderLeaderboard() {

  // Load leaderboard from localStorage
  let board =
    JSON.parse(localStorage.getItem("leaderboard")) || [];

  // Unique result ID
  const resultId = Date.now();

  // Add latest player result
  board.push({
    id: resultId,
    name: playerName,
    score,
    total: totalQuestions,
    percent: Math.round((score / totalQuestions) * 100),
    date: new Date().toLocaleString()
  });

  // Sort by highest score
  board.sort((a, b) => b.score - a.score);

  // Keep only top 10 entries
  board = board.slice(0, 10);

  // Save updated leaderboard
  localStorage.setItem(
    "leaderboard",
    JSON.stringify(board)
  );

  // Medal icons for top 3
  const medals = ["🥇", "🥈", "🥉"];

  // Render leaderboard UI
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

    // Get selected leaderboard index
    const index = $(this).data("index");

    // Reload leaderboard data
    let updatedBoard =
      JSON.parse(localStorage.getItem("leaderboard")) || [];

    // Remove selected score
    updatedBoard.splice(index, 1);

    // Save updated leaderboard
    localStorage.setItem(
      "leaderboard",
      JSON.stringify(updatedBoard)
    );

    // Refresh leaderboard UI
    $("#leaderboard").html("");
    renderLeaderboardOnly();
  });
}


/* =========================
    RENDER ONLY EXISTING
      LEADERBOARD DATA
========================= */

function renderLeaderboardOnly() {

  // Load saved leaderboard
  let board =
    JSON.parse(localStorage.getItem("leaderboard")) || [];

  // Handle empty leaderboard
  if (!board || board.length === 0) {

    $("#leaderboard").html(`
      <h5>🏆 Leaderboard</h5>

      <div class="empty-board text-center p-4">
        <h6>No scores yet</h6>
      </div>
    `);

    return;
  }

  // Medal icons
  const medals = ["🥇", "🥈", "🥉"];

  // Render leaderboard
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

  // Bind remove button events
  $(".remove-score").click(function () {

    const index = $(this).data("index");

    // Reload board
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
    renderLeaderboardOnly();
  });
}


/* =========================
     TRANSLATION API
   Uses MyMemory API
========================= */

async function translateText(text, targetLang) {

  // Skip translation if English
  if (!text || targetLang === "en") return text;

  try {

    // Build translation API URL
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;

    // Fetch translation
    const res = await $.getJSON(url);

    // Return translated text
    return res.responseData.translatedText || text;

  } catch (err) {

    // Return original text on error
    return text;
  }
}


/* =========================
       UI HELPERS
========================= */

function updateProgress() {

  // Calculate completion percentage
  const percent =
    ((currentIndex + 1) / totalQuestions) * 100;

  // Update progress bar
  $("#progressBar").css("width", percent + "%");

  // Update progress text
  $("#progressText").text(
    `Q ${currentIndex + 1} / ${totalQuestions}`
  );
}

function updateScore() {

  // Refresh score display
  $("#scoreBox").text(
    `Score: ${score}/${totalQuestions}`
  );
}

function showToast(msg, type) {

  // Display temporary notification
  $("#toast")
    .removeClass()
    .addClass(`toast-message toast-${type} toast-show`)
    .text(msg);

  // Auto-hide toast
  setTimeout(() =>
    $("#toast").removeClass("toast-show"),
    1500
  );
}

function lockAnswer(card) {

  // Disable answer buttons after short delay
  setTimeout(() => {
    card.find("button").prop("disabled", true);
  }, 150);
}


/* =========================
    TRANSLATION CACHE
   Prevents duplicate requests
========================= */

// Stores previously translated results
const translationCache = {};

async function translateText(text, targetLang) {

  // Skip translation if unnecessary
  if (!text || targetLang === "en") return text;

  // Generate cache key
  const key = `${text}-${targetLang}`;

  // Return cached translation if available
  if (translationCache[key]) {
    return translationCache[key];
  }

  try {

    // Build API request URL
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;

    // Request translation
    const res = await $.getJSON(url);

    // Save translated result
    const translated =
      res.responseData.translatedText || text;

    translationCache[key] = translated;

    return translated;

  } catch (err) {

    // Fallback to original text
    return text;
  }
}