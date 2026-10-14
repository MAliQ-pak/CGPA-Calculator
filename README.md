# GradePoint · CGPA Calculator
Aspiring student developer | Python enthusiast

**Live app:** https://maliq-pak.github.io/CGPA-Calculator/

GradePoint started as a Python script I wrote in my first semester to work out my GPA and CGPA. It's now a web app my friends can sign in to, with everyone's grades saved to their own account.

## Features
- **Accounts:** sign in with Google or with email and password (password reset by email included). Each person's grades are private to their account and sync across devices.
- **Quick setup after first sign-in:** one click for the default setup (BSCS courses and the standard grading scale), or a short guided setup: university, program, current semester, courses, grading scale, and an existing CGPA or past semesters. You can run it again from Settings.
- **Your own program:** every account has its own course list for each semester, so adding a semester fills in the right courses. Rename, add or remove courses and semesters any time under Settings → Program & courses.
- **Dashboard:** your CGPA, credit hours, latest and best semester GPA, and a progress chart of each semester's GPA and your CGPA after it.
- **Semesters:** enter marks out of 100, or pick a grade directly. BSCS semester 1–8 presets come with courses and credit hours filled in, or start a blank semester for any course list. You can also start from an existing CGPA instead of entering old semesters.
- **Planner:** the GPA you need over your next credit hours to reach a target CGPA, plus a table of common targets.
- **Settings:** edit your name, choose a light, dark or system theme, edit the grading scale to match your university, download or restore a backup, and delete your account.
- Saves automatically, keeps working offline (changes sync when you're back online), and works on phones. It can be added to a home screen like an app.

## How it's built
Plain HTML, CSS and JavaScript modules with no build step, hosted on GitHub Pages. Firebase handles sign-in (Firebase Authentication) and storage (Cloud Firestore). Each user has one document, `users/{uid}`, and `firestore.rules` makes sure only that user can read or write it.

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css` | Page shell and styles |
| `js/main.js` | Start-up, sign-in state, navigation |
| `js/views/` | Sign-in, setup wizard, and the Dashboard, Semesters, Planner, Settings and Program & courses pages |
| `js/calc.js` | GPA and CGPA calculations |
| `js/store.js` | Holds your data and autosaves it |
| `js/firebase.js` | Everything that talks to Firebase |
| `firebase-config.js` | Your Firebase project's web config |
| `firestore.rules` | Database security rules |
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
The app uses JavaScript modules, so it needs to be served over HTTP rather than opened as a file:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Signing in works on `localhost` by default. The Python script still runs with `python3 modified_CGPA.py`.

## Technologies Used
HTML, CSS, JavaScript, Firebase (Authentication, Cloud Firestore), Python
