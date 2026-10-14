# Each course is listed once, together with its credit hours.
Courses_and_Semesters = {
    1: {"ITC": 3, "FOP": 4, "English(1)": 3, "Calculus": 3, "Basic Electronics": 3, "Islamic Studies": 2},
    2: {"DLD": 4, "OOP": 4, "English(2)": 3, "Probability & Statistics": 3, "Urdu": 2, "Pakistan Studies": 2},
    3: {"CAO": 4, "DSA": 4, "English(3)": 3, "Discrete Structures": 3, "Differential Equations": 3},
    4: {"DAA": 3, "Theory of Automata": 3, "Database Systems": 4, "Linear Algebra": 3, "University Elective II": 3},
    5: {"Computer Networks": 4, "Multi-variate Calculus": 3, "Operating Systems": 4, "ISE": 3, "CS Elective 1": 3},
    6: {"AI": 4, "Compiler Construction": 3, "Numerical Computing": 3, "CS Elective 2": 3, "Professional Practices": 3},
    7: {"CS Elective 3": 3, "CS Elective 4": 3, "FYP 1": 3, "University Elective III": 3, "PDC": 3},
    8: {"CS Elective 5": 3, "University Elective IV": 3, "FYP 2": 3, "Information Security": 3},
}


def GPA(marks):
    if marks >= 80:
        return 4.0
    elif marks >= 70:
        return 3.5
    elif marks >= 60:
        return 3.0
    elif marks >= 55:
        return 2.5
    elif marks >= 50:
        return 2.0
    return 0.0


def ask_number(prompt, low, high, cast=float, allow_blank=False):
    """Keep asking until the user enters a number between low and high."""
    while True:
        text = input(prompt).strip()
        if allow_blank and text == "":
            return None
        try:
            value = cast(text)
        except ValueError:
            print("Please enter a number.")
            continue
        if low <= value <= high:
            return value
        print(f"Please enter a value from {low} to {high}.")


sem = ask_number("From 1 to 8 enter your semester: ", 1, 8, cast=int)

print()
GPA_product = 0.0
sum_credit_hours = 0.0
for course, credit_hours in Courses_and_Semesters[sem].items():
    marks = ask_number(f"Enter your marks for {course}: ", 0, 100)
    GPA_product += GPA(marks) * credit_hours
    sum_credit_hours += credit_hours

semester_GPA = GPA_product / sum_credit_hours
print(f"\nYour GPA for semester {sem} is {semester_GPA:.2f}")

if sem > 1:
    print("\nTo get your CGPA, enter your record before this semester (press Enter to skip).")
    previous_CGPA = ask_number("Previous CGPA: ", 0, 4, allow_blank=True)
    if previous_CGPA is not None:
        previous_credits = ask_number("Total credit hours completed before this semester: ", 1, 1000)
        CGPA = (previous_CGPA * previous_credits + GPA_product) / (previous_credits + sum_credit_hours)
        print(f"Your CGPA after semester {sem} is {CGPA:.2f}")
