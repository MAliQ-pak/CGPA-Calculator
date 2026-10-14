# GradePoint · CGPA Calculator
Aspiring student developer | Python enthusiast

**Live app:** https://maliq-pak.github.io/CGPA-Calculator/

GradePoint started as a Python script I wrote in my first semester to work out my GPA and CGPA. It's now a web app my friends can sign in to, with everyone's grades saved to their own account.

## Features
- **Accounts:** sign in with Google or with email and password (password reset by email included). Each person's grades are private to their account and sync across devices.
- **Quick setup after first sign-in:** one click for the default setup (BSCS courses and the standard grading scale), or a short guided setup: university, program, current semester, courses, grading scale, and an existing CGPA or past semesters. You can run it again from Settings.
- **Your own program:** every account has its own course list for each semester, so adding a semester fills in the right courses. Rename, add or remove courses and semesters any time under Settings → Program & courses.
- **Share your program with a code:** set up your university's real course list once and share a 6-character code or link. Friends copy it during setup or from the Program & courses page. Only course names and credit hours are shared, never marks, and later edits are shared automatically.
- **Dashboard:** your CGPA, credit hours, latest and best semester GPA, and a progress chart of each semester's GPA and your CGPA after it.
- **Semesters:** enter marks out of 100, or pick a grade directly. New semesters are filled in from your program, or start a blank one. Courses can be renamed, added and removed right in the list. You can also start from an existing CGPA instead of entering old semesters.
- **Repeated courses:** mark a course as a retake of an earlier one (same-name courses are suggested). Only one attempt counts toward CGPA, the latest or the best (your choice in Settings), while semester GPAs stay as they were.
- **Marks breakdown:** track quizzes, assignments, mid-terms and the final for any course as you get them back. See your running total and pace, and the percentage you need on the remaining work for each grade. Once everything is in, the total becomes the course's marks.
- **Planner:** the GPA you need over your next credit hours to reach a target CGPA, plus a table of common targets.
- **What if:** try grades for a semester's courses, including ones still in progress (with "on pace" grades from the marks breakdown), and see the resulting semester GPA and CGPA. Nothing is saved.
- **Share your result:** a branded image of your CGPA (optionally without your name or semester chart) to download or share, and a printable PDF summary of every semester, grade and GPA.
- **Achievements:** levels (Fresher to Legend) and 16 badges for good habits, improvement and milestones, with a weekly check-in streak and a little confetti when you unlock one. XP comes from what you've actually entered, so it can't be farmed. Can be turned off in Settings.
- **Settings:** edit your name, choose a light, dark or system theme, edit the grading scale to match your university, download or restore a backup, and delete your account.
- Saves automatically, keeps working offline (changes sync when you're back online), and works on phones. It can be added to a home screen like an app.

## How it's built
Plain HTML, CSS and JavaScript modules with no build step, hosted on GitHub Pages. Firebase handles sign-in (Firebase Authentication) and storage (Cloud Firestore). Each user has one document, `users/{uid}`, and `firestore.rules` makes sure only that user can read or write it. Shared programs live in `programs/{code}`: anyone signed in can open one by its code (nobody can list them), and only the person who shared it can change or remove it.

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css` | Page shell and styles |
| `js/main.js` | Start-up, sign-in state, navigation |
| `js/views/` | Sign-in, setup wizard, and the Dashboard, Semesters, Planner, Settings and Program & courses pages |
| `js/calc.js` | GPA and CGPA calculations |
| `js/store.js` | Holds your data and autosaves it |
| `js/firebase.js` | Everything that talks to Firebase |
| `js/sharing.js` | Share codes and copying a friend's program |
| `js/card.js` | Draws the shareable result card |
| `js/gamify.js`, `js/achievements.js` | Levels, badges and streak; recording and celebrating new badges |
| `firebase-config.js` | Your Firebase project's web config |
| `firestore.rules` | Database security rules |
| `tests/` | Unit and browser tests, and the local dev server |
| `modified_CGPA.py` | The original command-line calculator |

## Setting up Firebase (one time, about 5 minutes)
1. Go to https://console.firebase.google.com, click **Create a project**, and give it a name (for example `gradepoint`). You can turn off Google Analytics.
2. **Sign-in methods:** open **Build → Authentication → Get started**. Under **Sign-in method**, enable **Google** (choose a support email) and **Email/Password**.
3. **Allow the site:** in **Authentication → Settings → Authorized domains**, click **Add domain** and enter `maliq-pak.github.io`.
4. **Database:** open **Build → Firestore Database → Create database**. Choose a location near you (for example `asia-south1`, Mumbai) and start in **production mode**. Then open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. **Web config:** open **Project settings** (the gear icon) → **Your apps** → the **Web** icon (`</>`). Register an app (no hosting needed) and copy the `firebaseConfig` values into `firebase-config.js`.
6. Commit and push to `main`. GitHub Pages updates the live site within a minute or two.

The values in `firebase-config.js` are meant to be public. What protects the data is the rules file in step 4.

## Running locally
The app uses JavaScript modules, so it needs to be served over HTTP rather than opened as a file. With Node.js installed:

```
npm install
npm start
```

Then open http://localhost:4173. Signing in works on `localhost` by default. The Python script still runs with `python3 modified_CGPA.py`.

## Tests
```
npm test            # everything
npm run test:unit   # GPA and CGPA calculations (js/calc.js)
npm run test:e2e    # the app in a real browser (Playwright)
```

The browser tests replace Firebase with `tests/mock-firebase.js`, so they need no Firebase project or network. They cover sign-up and sign-in, the setup wizard, entering grades, the dashboard, planner, program editing, backups, account deletion and phone layouts. GitHub runs all of them on every push and pull request (`.github/workflows/tests.yml`). The first time you run the browser tests locally, install the browser with `npx playwright install chromium`.

## Technologies Used
HTML, CSS, JavaScript, Firebase (Authentication, Cloud Firestore), Python
