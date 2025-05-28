// Fetch and display student list
async function fetchStudents() {
    const tableBody = document.querySelector("#student-list tbody");
    tableBody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>"; // Updated colspan to 4

    try {
        // Dynamic API URL (Works for both local and Render)
        const API_BASE_URL = window.location.hostname.includes("localhost") 
            ? "http://localhost:9000" 
            : "https://attendance-co83.onrender.com"; 

        const res = await fetch(`${API_BASE_URL}/teacher/students`);

        if (!res.ok) {
            throw new Error(`Failed to fetch student data. Status: ${res.status}`);
        }

        const students = await res.json();
        tableBody.innerHTML = ""; // Clear loading message

        if (!Array.isArray(students) || students.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='4'>No students found</td></tr>";
            return;
        }

        // Generate device ID if not already exists
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = self.crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
        }

        students.forEach(student => {
            if (!student.studentID || !student.name) return; // Ensure valid data
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${student.studentID}</td>
                <td>${student.name}</td>
                <td>
                    <input type="checkbox" class="student-checkbox" data-id="${student.studentID}">
                </td>
                <td>
                    <button class="reset-password-btn" data-id="${student.studentID}">
                        Reset Password
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners to reset password buttons
        document.querySelectorAll('.reset-password-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentID = e.target.dataset.id;
                if (confirm(`Reset password for student ${studentID}? Default will be their student ID.`)) {
                    try {
                        const res = await fetch(`${API_BASE_URL}/teacher/reset-password`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ studentID })
                        });
                        
                        if (res.ok) {
                            alert('Password reset successfully!');
                        } else {
                            const error = await res.json();
                            alert(`Error: ${error.message}`);
                        }
                    } catch (err) {
                        console.error('Password reset error:', err);
                        alert('Failed to reset password');
                    }
                }
            });
        });

    } catch (error) {
        tableBody.innerHTML = "<tr><td colspan='4' style='color:red;'>Error loading students</td></tr>";
        console.error("Error fetching students:", error);
    }
}

// Load students when the page loads
document.addEventListener("DOMContentLoaded", fetchStudents);

// Function to add new student
async function addStudent() {
    const studentID = document.getElementById('new-student-id').value;
    const name = document.getElementById('new-student-name').value;
    const password = document.getElementById('new-student-password').value || studentID; // Default to student ID
    
    if (!studentID || !name) {
        alert('Student ID and Name are required');
        return;
    }

    try {
        const API_BASE_URL = window.location.hostname.includes("localhost") 
            ? "http://localhost:9000" 
            : "https://attendance-co83.onrender.com";
        
        const res = await fetch(`${API_BASE_URL}/teacher/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentID, name, password })
        });
        
        if (res.ok) {
            alert('Student added successfully!');
            document.getElementById('new-student-id').value = '';
            document.getElementById('new-student-name').value = '';
            document.getElementById('new-student-password').value = '';
            fetchStudents(); // Refresh list
        } else {
            const error = await res.json();
            alert(`Error: ${error.message}`);
        }
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Failed to add student');
    }
}