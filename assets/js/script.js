let score = 0;
let totalQuestions = 0;
let quizLocked = false;

$(document).ready(function () {
  $("#generateBtn").click(loadQuiz);
});

function setLoading(state) {
  $("#loader").toggleClass("d-none", !state);
  $("#generateBtn").prop("disabled", state);
}

function decodeHTML(html) {
  return $("<textarea>").html(html).text();
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

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

    return res?.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

function updateScore() {
  $("#scoreBox").text(`Score: ${score} / ${totalQuestions}`);
}

async function loadQuiz() {

  if (quizLocked) return;
  quizLocked = true;

  $("#quizBox").html("");
  $("#scoreBox").html("");
  score = 0;

  setLoading(true);

  const category = $("#category").val();
  const difficulty = $("#difficulty").val();
  const language = $("#language").val();

  try {

    const data = await $.getJSON(
      `https://opentdb.com/api.php?amount=5&category=${category}&difficulty=${difficulty}&type=multiple`
    );

    const questions = data.results || [];
    totalQuestions = questions.length;

    for (let i = 0; i < questions.length; i++) {

      const q = questions[i];

      const questionText = decodeHTML(q.question);
      const translatedQ = await translate(questionText, language);

      const correct = await translate(decodeHTML(q.correct_answer), language);

      const incorrect = await Promise.all(
        q.incorrect_answers.map(a =>
          translate(decodeHTML(a), language)
        )
      );

      const options = shuffle([correct, ...incorrect]);

      const card = $(`
        <div class="question-card">
          <div class="fw-bold mb-2">Q${i + 1}. ${translatedQ}</div>
          <div class="options"></div>
        </div>
      `);

      options.forEach(option => {

        const btn = $(`<button class="btn btn-light option-btn">${option}</button>`);

        btn.click(function () {

          const allBtns = card.find("button");
          allBtns.prop("disabled", true);

          if (option === correct) {
            btn.addClass("correct");
            score++;
          } else {
            btn.addClass("wrong");

            allBtns.each(function () {
              if ($(this).text() === correct) {
                $(this).addClass("correct");
              }
            });
          }

          updateScore();
        });

        card.find(".options").append(btn);
      });

      $("#quizBox").append(card);
    }

    updateScore();

  } catch (err) {
    console.error(err);
    $("#quizBox").html(
      "<h4 class='text-danger text-center'>Failed to load quiz. Try again.</h4>"
    );
  }

  setLoading(false);
  quizLocked = false;
}