Courses_and_Semesters = {
    "courses_sem1":["ITC", "FOP", "English(1)", "Calculus", "Basic Electronics", "Islamic Studies"],
    "courses_sem2":["DLD", "OOP", "English(2)", "Probability & Statistics", "Urdu", "Pakistan Studies"],
    "courses_sem3":["CAO", "DSA", "English(3)", "Discrete Structures", "Differential Equations"],
    "courses_sem4":["DAA", "Theory of Automata", "Database Systems", "Linear Algebra", "University Elective II"],
    "courses_sem5":["Computer Networks", "Multi-variate Calculus", "Operating Systems", "ISE", "CS Elective 1"],
    "courses_sem6":["AI", "Compiler Construction", "Numerical Computing", "CS Elective 2", "Professional Practices"],
    "courses_sem7":["CS Elective 3", "CS Elective 4", "FYP 1", "University Elective III", "PDC"],
    "courses_sem8":["CS Elective 5", "University Elective IV", "FYP 2", "Information Security"]
}

sem = int(input("From 1 to 8 enter your semester: "))

def GPA(marks):
    gpa = 0
    if 80 <= marks <= 100:
        gpa = 4.0
    elif 70 <= marks < 80:
        gpa = 3.5
    elif 60 <= marks < 70:
        gpa = 3.0
    elif 55 <= marks < 60:
        gpa = 2.5
    elif 50 <= marks < 55:
        gpa = 2.0
    elif 0 <= marks < 50:
        print("GPA below 2.0")
    else:
        print("Invalid Marks! Try Again")
    return gpa

def credit_hours(Subject):
    credit_hour = 0.0
    if Subject in ["Islamic Studies","Urdu","Pakistan Studies"]:
        credit_hour = 2.0
    elif Subject in ["ITC","English(1)","Calculus","Basic Electronics","English(2)","Probability & Statistics","English(3)","Discrete Structures","Differential Equations","DAA","Theory of Automata","Linear Algebra","University Elective II","Multi-variate Calculus","ISE","CS Elective 1","Compiler Construction","Numerical Computing","CS Elective 2","Professional Practices","CS Elective 3","CS Elective 4""FYP 1","University Elective III","PDC","CS Elective 5","University Elective IV","FYP 2","Information Security"]:
        credit_hour = 3.0
    elif Subject in ["FOP","DLD", "OOP","CAO","DSA","Database Systems","Computer Networks","Operating Systems","AI"]:
        credit_hour = 4.0
    return credit_hour


if 1 <= sem <= 8:
    sem_GPA_and_credit_hours = {}
    print("\n", end="")
    for course in Courses_and_Semesters[f"courses_sem{sem}"]:
            marks = int(input(f"Enter your marks for {course}: "))
            subject = course
            sem_GPA_and_credit_hours[course] = {
                'GPA': GPA(marks),
            'credit hours': credit_hours(subject)
            }

    CGPA = 0.0
    GPA_product = 0.0
    sum_credit_hours = 0.0

    for course, values in sem_GPA_and_credit_hours.items():
        GPA_product += values['GPA'] * values['credit hours']
        sum_credit_hours += values['credit hours']

    CGPA = GPA_product / sum_credit_hours
    print(f"\nYour CGPA for the semester is {CGPA:.2f}")
else:
    print("Invalid Input")