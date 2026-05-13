let score = 0;
let totalQuestions = 0;

let currentIndex = 0;

let questionsData = [];
let userAnswers = [];

let timer;
let timeLeft = 15;

/* PAGE */
function showPage(page) {

  $("#homePage, #quizPage, #resultsPage")
    .addClass("d-none");

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
      $("body").hasClass("light-mode")
        ? "light"
        : "dark"
    );
  });
});

/* HOME */
function goHome() {

  clearInterval(timer);

  showPage("homePage");
}

/* UTILS */
function decodeHTML(html) {
  return $("<textarea>").html(html).text();
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/* TRANSLATE */
async function translate(text, lang) {

  if (lang === "en") return text;

  try {

    const res = await $.ajax({
      url: "https://api.mymemory.translated.net/get",
      data: {
        q: text,
        langpair: `en|${lang}`
      }
    });

    return res.responseData.translatedText || text;

  } catch {
    return text;
  }
}

/* TIMER */
function startTimer() {

  clearInterval(timer);

  timeLeft = 15;

  timer = setInterval(() => {

    timeLeft--;

    $("#timerText").text(`⏱️ ${timeLeft}s`);

    $("#timerBarFill").css(
      "width",
      `${(timeLeft / 15) * 100}%`
    );

    if (timeLeft <= 0) {

      clearInterval(timer);

      nextQuestion();
    }

  }, 1000);
}

/* PROGRESS */
function updateProgress() {

  const percent =
    ((currentIndex + 1) / totalQuestions) * 100;

  $("#progressBar").css("width", percent + "%");

  $("#progressText").text(
    `Question ${currentIndex + 1} / ${totalQuestions}`
  );
}

/* LOAD QUIZ */
async function loadQuiz() {

  score = 0;

  currentIndex = 0;

  userAnswers = [];

  $("#reviewAnswers").html("");

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

  renderQuestion();
}
/* =========================
   VISUAL FEEDBACK SYSTEM
========================= */

function showToast(message, type) {

  const toast = $("#toast");

  toast
    .removeClass("toast-show toast-correct toast-wrong")
    .addClass(type === "correct" ? "toast-correct" : "toast-wrong")
    .text(message);

  setTimeout(() => toast.addClass("toast-show"), 10);

  setTimeout(() => toast.removeClass("toast-show"), 1500);
}

function vibrate(type) {
  if (!navigator.vibrate) return;

  if (type === "correct") {
    navigator.vibrate([80, 30, 80]);
  } else {
    navigator.vibrate([200]);
  }
}

function animateButton(btn, type) {
  btn.removeClass("pop shake");

  setTimeout(() => {
    btn.addClass(type === "correct" ? "pop" : "shake");
  }, 10);
}

/* RENDER */
async function renderQuestion() {

  const q = questionsData[currentIndex];

  const lang = $("#language").val();

  const question =
    await translate(
      decodeHTML(q.question),
      lang
    );

  const correct =
    await translate(
      decodeHTML(q.correct_answer),
      lang
    );

  const incorrect =
    await Promise.all(
      q.incorrect_answers.map(a =>
        translate(decodeHTML(a), lang)
      )
    );

  const options =
    shuffle([correct, ...incorrect]);

  const card = $(`
    <div class="question-card ${q.difficulty}">
      <h5>${question}</h5>
      <div class="options mt-3"></div>
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

  const isCorrect = option === correct;

  userAnswers[currentIndex] = {
    question,
    selected: option,
    correct
  };

  if (isCorrect) {
    score++;
    showToast("✅ Correct!", "correct");
    vibrate("correct");

    confetti({
      particleCount: 120,
      spread: 80
    });

  } else {
    showToast("❌ Wrong!", "wrong");
    vibrate("wrong");
  }

  animateButton(btn, isCorrect ? "correct" : "wrong");

  lockAnswer(card, correct);

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

/* LOCK ANSWERS */
function lockAnswer(card, correct) {

  setTimeout(() => {

    card.find("button").each(function () {

      $(this).prop("disabled", true);

      if ($(this).text() === correct) {
        $(this).addClass("correct pop");
      }

      const selected = userAnswers[currentIndex]?.selected;

      if (selected === $(this).text() && selected !== correct) {
        $(this).addClass("wrong shake");
      }
    });

  }, 200);
}

/* NAVIGATION */
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

/* SCORE */
function updateScore() {

  $("#scoreBox").html(
    `Score: ${score} / ${totalQuestions}`
  );
}

/* SAVE */
function saveProgress() {

  localStorage.setItem(
    "quizProgress",
    JSON.stringify({
      currentIndex,
      score,
      userAnswers
    })
  );
}

/* RESULTS */
function showResults() {

  clearInterval(timer);

  showPage("resultsPage");

  const accuracy =
    Math.round((score / totalQuestions) * 100);

  let badge = "";

  if (score === totalQuestions) {

    badge = "🏆 Quiz Master";

    confetti({
      particleCount: 150,
      spread: 90
    });

  } else if (accuracy >= 70) {

    badge = "🔥 Smart Player";

  } else {

    badge = "🎯 Keep Practicing";
  }

  /* BEST SCORE */
  let best =
    localStorage.getItem("bestScore") || 0;

  if (score > best) {

    localStorage.setItem("bestScore", score);

    best = score;
  }

  /* LEADERBOARD */
  let leaderboard =
    JSON.parse(
      localStorage.getItem("leaderboard")
    ) || [];

  leaderboard.push(score);

  leaderboard.sort((a, b) => b - a);

  leaderboard = leaderboard.slice(0, 5);

  localStorage.setItem(
    "leaderboard",
    JSON.stringify(leaderboard)
  );

  $("#finalScore").html(`
    <h3>${score} / ${totalQuestions}</h3>
    <p>Accuracy: ${accuracy}%</p>
    <h4>${badge}</h4>
  `);

  $("#bestScore").html(`
    🏆 Best Score: ${best}
  `);

  $("#leaderboard").html(`
    <h5 class="mt-3">Top Scores</h5>
    ${leaderboard.map(s => `<div>${s}</div>`).join("")}
  `);

  /* REVIEW ANSWERS */
  userAnswers.forEach((a, i) => {

    $("#reviewAnswers").append(`
      <div class="review-card">

        <h6>Q${i + 1}. ${a.question}</h6>

        <div>
          Your Answer:
          <span class="${
            a.selected === a.correct
              ? 'text-success'
              : 'text-danger'
          }">
            ${a.selected}
          </span>
        </div>

        <div>
          Correct Answer:
          <span class="text-success">
            ${a.correct}
          </span>
        </div>

      </div>
    `);
  });
}