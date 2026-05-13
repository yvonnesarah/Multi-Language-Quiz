const quizBox = document.getElementById("quizBox");
const scoreBox = document.getElementById("scoreBox");
const loader = document.getElementById("loader");
const generateBtn = document.getElementById("generateBtn");

let score = 0;
let totalQuestions = 0;
let quizLocked = false;

generateBtn.addEventListener("click", loadQuiz);

async function translateText(text, targetLang) {
  if (targetLang === "en") return text;

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
    );
    const data = await res.json();
    return data?.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function setLoading(state) {
  loader.style.display = state ? "block" : "none";
  generateBtn.disabled = state;
}

function updateScore() {
  scoreBox.textContent = `Score: ${score} / ${totalQuestions}`;
}

async function loadQuiz() {
  if (quizLocked) return;
  quizLocked = true;

  quizBox.innerHTML = "";
  scoreBox.innerHTML = "";
  score = 0;

  setLoading(true);

  const category = document.getElementById("category").value;
  const difficulty = document.getElementById("difficulty").value;
  const language = document.getElementById("language").value;

  try {
    const res = await fetch(
      `https://opentdb.com/api.php?amount=5&category=${category}&difficulty=${difficulty}&type=multiple`
    );

    const data = await res.json();
    const questions = data.results || [];

    totalQuestions = questions.length;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      const questionText = decodeHTML(q.question);
      const translatedQuestion = await translateText(questionText, language);

      const correct = await translateText(decodeHTML(q.correct_answer), language);

      const incorrect = await Promise.all(
        q.incorrect_answers.map(a =>
          translateText(decodeHTML(a), language)
        )
      );

      const options = shuffle([correct, ...incorrect]);

      const card = document.createElement("div");
      card.className = "question-card";

      const title = document.createElement("div");
      title.className = "question";
      title.textContent = `Q${i + 1}. ${translatedQuestion}`;

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "options";

      options.forEach(option => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = option;

        btn.addEventListener("click", () => {
          const allBtns = optionsDiv.querySelectorAll("button");
          allBtns.forEach(b => (b.disabled = true));

          if (option === correct) {
            btn.classList.add("correct");
            score++;
          } else {
            btn.classList.add("wrong");
            allBtns.forEach(b => {
              if (b.textContent === correct) {
                b.classList.add("correct");
              }
            });
          }

          updateScore();
        });

        optionsDiv.appendChild(btn);
      });

      card.appendChild(title);
      card.appendChild(optionsDiv);
      quizBox.appendChild(card);
    }

    updateScore();
  } catch (err) {
    console.error(err);
    quizBox.innerHTML = "<h3>Failed to load quiz. Try again.</h3>";
  }

  setLoading(false);
  quizLocked = false;
}