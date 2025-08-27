let financialData = {
    expenses: [],
    income: [],
    mortgage: null,
    loans: [],
    savings: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    updateDashboard();
    setupNavigation();
    setCurrentDate();

    // Navigation toggle functionality
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.getElementById('nav-menu');

    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });
});

// Navigation functionality
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links and sections
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            const targetId = this.getAttribute('href').substring(1);
            
            // Show the target section
            document.getElementById(targetId).classList.add('active');
            
            // Close mobile navigation menu if open
            if (navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
            
            // Scroll to top
            window.scrollTo(0, 0);
        });
    });
}

// Set current date for date inputs
function setCurrentDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expense-date').value = today;
    document.getElementById('income-date').value = today;
}

// Mortgage Calculator
function calculateMortgage() {
    try {
        const homePrice = validateNumberInput(document.getElementById('home-price').value, 'Home Price', 0);
        const downPayment = validateNumberInput(document.getElementById('down-payment').value, 'Down Payment', 0);
        const interestRate = validateNumberInput(document.getElementById('interest-rate').value, 'Interest Rate', 0);
        const loanTerm = validateNumberInput(document.getElementById('loan-term').value, 'Loan Term', 1, 30);
        
        const loanAmount = homePrice - downPayment;
        const monthlyRate = interestRate / 100 / 12;
        const numberOfPayments = loanTerm * 12;
        
        if (loanAmount <= 0 || monthlyRate <= 0 || numberOfPayments <= 0) {
            showError('All fields must be filled with valid values.');
            return;
        }
        
        const monthlyPayment = loanAmount * 
            (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
            (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
        
        const totalPayment = monthlyPayment * numberOfPayments;
        const totalInterest = totalPayment - loanAmount;
        
        // Update results
        document.getElementById('monthly-payment').textContent = formatCurrency(monthlyPayment);
        document.getElementById('total-payment').textContent = formatCurrency(totalPayment);
        document.getElementById('total-interest').textContent = formatCurrency(totalInterest);
        
        // Save to data
        financialData.mortgage = {
            homePrice,
            downPayment,
            interestRate,
            loanTerm,
            monthlyPayment,
            totalPayment,
            totalInterest
        };
        
        saveToLocalStorage();
        updateDashboard();
        showSuccess('Mortgage calculated successfully!');
    } catch (error) {
        showError(error.message);
    }
}

// Loan Calculator
function calculateLoan() {
    try {
        const loanAmount = validateNumberInput(document.getElementById('loan-amount').value, 'Loan Amount', 0);
        const interestRate = validateNumberInput(document.getElementById('loan-interest').value, 'Interest Rate', 0);
        const loanTerm = validateNumberInput(document.getElementById('loan-term-months').value, 'Loan Term', 1);
        
        const monthlyRate = interestRate / 100 / 12;
        
        if (loanAmount <= 0 || monthlyRate <= 0 || loanTerm <= 0) {
            showError('All fields must be filled with valid values.');
            return;
        }
        
        const monthlyPayment = loanAmount * 
            (monthlyRate * Math.pow(1 + monthlyRate, loanTerm)) / 
            (Math.pow(1 + monthlyRate, loanTerm) - 1);
        
        const totalPayment = monthlyPayment * loanTerm;
        const totalInterest = totalPayment - loanAmount;
        
        // Update results
        document.getElementById('loan-monthly').textContent = formatCurrency(monthlyPayment);
        document.getElementById('loan-total').textContent = formatCurrency(totalPayment);
        document.getElementById('loan-interest-total').textContent = formatCurrency(totalInterest);
        
        // Add to loans array
        const loan = {
            amount: loanAmount,
            interestRate,
            term: loanTerm,
            monthlyPayment,
            totalPayment,
            totalInterest,
            createdAt: new Date().toISOString()
        };
        
        financialData.loans.push(loan);
        saveToLocalStorage();
        updateDashboard();
        showSuccess('Loan calculated successfully!');
    } catch (error) {
        showError(error.message);
    }
}

// Expense Tracker
function addExpense() {
    try {
        const amount = validateNumberInput(document.getElementById('expense-amount').value, 'Expense Amount', 0);
        const category = validateRequired(document.getElementById('expense-category').value, 'Category');
        const date = validateRequired(document.getElementById('expense-date').value, 'Date');
        const description = validateRequired(document.getElementById('expense-description').value, 'Description');
        
        const expense = {
            amount,
            category,
            date,
            description,
            createdAt: new Date().toISOString()
        };
        
        financialData.expenses.push(expense);
        saveToLocalStorage();
        updateExpenseList();
        updateDashboard();
        
        // Clear form
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-description').value = '';
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
        
        showSuccess('Expense added successfully!');
    } catch (error) {
        showError(error.message);
    }
}

function updateExpenseList() {
    const expenseList = document.getElementById('expense-list');
    const template = expenseList.querySelector('.template');
    
    // Clear existing items (except template)
    expenseList.querySelectorAll('.expense-item:not(.template)').forEach(item => item.remove());
    
    // Add recent expenses (last 10)
    const recentExpenses = financialData.expenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
    
    recentExpenses.forEach(expense => {
        const item = template.cloneNode(true);
        item.classList.remove('template');
        
        item.querySelector('.amount').textContent = formatCurrency(expense.amount);
        item.querySelector('.category').textContent = expense.category;
        item.querySelector('.date').textContent = formatDate(expense.date);
        item.querySelector('.description').textContent = expense.description;
        
        item.querySelector('.btn-delete').addEventListener('click', () => {
            deleteExpense(expense.createdAt);
        });
        
        expenseList.appendChild(item);
    });
}

function deleteExpense(createdAt) {
    financialData.expenses = financialData.expenses.filter(expense => expense.createdAt !== createdAt);
    saveToLocalStorage();
    updateExpenseList();
    updateDashboard();
    showSuccess('Expense deleted successfully!');
}

// Income Tracker
function addIncome() {
    try {
        const amount = validateNumberInput(document.getElementById('income-amount').value, 'Income Amount', 0);
        const source = validateRequired(document.getElementById('income-source').value, 'Source');
        const date = validateRequired(document.getElementById('income-date').value, 'Date');
        
        const income = {
            amount,
            source,
            date,
            createdAt: new Date().toISOString()
        };
        
        financialData.income.push(income);
        saveToLocalStorage();
        updateIncomeList();
        updateDashboard();
        
        // Clear form
        document.getElementById('income-amount').value = '';
        document.getElementById('income-date').value = new Date().toISOString().split('T')[0];
        
        showSuccess('Income added successfully!');
    } catch (error) {
        showError(error.message);
    }
}

function updateIncomeList() {
    const incomeList = document.getElementById('income-list');
    const template = incomeList.querySelector('.template');
    
    // Clear existing items (except template)
    incomeList.querySelectorAll('.income-item:not(.template)').forEach(item => item.remove());
    
    // Add recent income (last 10)
    const recentIncome = financialData.income
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
    
    recentIncome.forEach(income => {
        const item = template.cloneNode(true);
        item.classList.remove('template');
        
        item.querySelector('.amount').textContent = formatCurrency(income.amount);
        item.querySelector('.source').textContent = income.source;
        item.querySelector('.date').textContent = formatDate(income.date);
        
        item.querySelector('.btn-delete').addEventListener('click', () => {
            deleteIncome(income.createdAt);
        });
        
        incomeList.appendChild(item);
    });
}

function deleteIncome(createdAt) {
    financialData.income = financialData.income.filter(income => income.createdAt !== createdAt);
    saveToLocalStorage();
    updateIncomeList();
    updateDashboard();
    showSuccess('Income deleted successfully!');
}

// Savings Calculator
function calculateSavings() {
    try {
        const goal = validateNumberInput(document.getElementById('savings-goal').value, 'Savings Goal', 0);
        const current = validateNumberInput(document.getElementById('current-savings').value, 'Current Savings', 0);
        const monthly = validateNumberInput(document.getElementById('monthly-contribution').value, 'Monthly Contribution', 0);
        const interestRate = validateNumberInput(document.getElementById('savings-interest').value, 'Interest Rate', 0);
        
        const monthlyRate = interestRate / 100 / 12;
        let months = 0;
        let totalContributions = 0;
        let totalInterest = 0;
        
        // Use the compound interest formula for more accurate calculation
        if (monthlyRate > 0) {
            // Formula: n = log(1 + (goal * monthlyRate) / (monthly + current * monthlyRate)) / log(1 + monthlyRate)
            const numerator = Math.log(1 + (goal * monthlyRate) / (monthly + current * monthlyRate));
            const denominator = Math.log(1 + monthlyRate);
            months = Math.ceil(numerator / denominator);
            
            // Calculate total contributions and interest
            totalContributions = current + (monthly * months);
            
            // Calculate final balance and total interest
            const futureValue = current * Math.pow(1 + monthlyRate, months) + 
                              monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
            totalInterest = futureValue - totalContributions;
        } else {
            // No interest case
            months = Math.ceil((goal - current) / monthly);
            totalContributions = current + (monthly * months);
            totalInterest = 0;
        }
        
        // Ensure months is reasonable
        if (months > 600) { // 50 years max
            months = 600;
            totalContributions = current + (monthly * months);
            totalInterest = 0; // Simplified for very long terms
        }
        
        // Update results
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        let timeText = `${months} months`;
        if (years > 0) {
            timeText = `${years} years ${remainingMonths > 0 ? `${remainingMonths} months` : ''}`.trim();
        }
        
        document.getElementById('time-to-goal').textContent = timeText;
        document.getElementById('total-contributions').textContent = formatCurrency(totalContributions);
        document.getElementById('total-interest-earned').textContent = formatCurrency(totalInterest);
        
        // Save to data
        financialData.savings = {
            goal,
            current,
            monthly,
            interestRate,
            timeToGoal: months,
            totalContributions,
            totalInterest
        };
        
        saveToLocalStorage();
        updateDashboard();
        showSuccess('Savings calculated successfully!');
    } catch (error) {
        showError(error.message);
    }
}

// Dashboard Updates
function updateDashboard() {
    // Calculate totals
    const totalExpenses = financialData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncome = financialData.income.reduce((sum, income) => sum + income.amount, 0);
    const totalSavings = financialData.savings ? financialData.savings.current : 0;
    const totalLoans = financialData.loans.reduce((sum, loan) => sum + loan.amount, 0);
    const mortgageBalance = financialData.mortgage ? financialData.mortgage.totalPayment - financialData.mortgage.totalInterest : 0;
    
    // Update dashboard cards
    const cards = document.querySelectorAll('.card');
    cards[0].querySelector('.stat').textContent = formatCurrency(mortgageBalance);
    cards[1].querySelector('.stat').textContent = formatCurrency(totalLoans);
    cards[2].querySelector('.stat').textContent = formatCurrency(totalIncome);
    cards[3].querySelector('.stat').textContent = formatCurrency(totalSavings);
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('kk-KZ', {
        style: 'currency',
        currency: 'KZT',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Validation Functions
function validateNumberInput(value, fieldName, min = 0, max = Infinity) {
    const num = parseFloat(value);
    if (isNaN(num) || num < min || num > max) {
        throw new Error(`${fieldName} must be a valid number between ${min} and ${max}`);
    }
    return num;
}

function validateRequired(value, fieldName) {
    if (!value || value.trim() === '') {
        throw new Error(`${fieldName} is required`);
    }
    return value;
}

function showError(message) {
    // Create or show error message
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4757;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    // Create or show success message
    let successDiv = document.getElementById('success-message');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2ed573;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(successDiv);
    }
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

// Local Storage
function saveToLocalStorage() {
    localStorage.setItem('financialData', JSON.stringify(financialData));
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('financialData');
    if (savedData) {
        financialData = JSON.parse(savedData);
        updateExpenseList();
        updateIncomeList();
    }
}

// Export/Import functionality
function exportData() {
    const dataStr = JSON.stringify(financialData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'financial-data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            financialData = data;
            saveToLocalStorage();
            updateExpenseList();
            updateIncomeList();
            updateDashboard();
            showSuccess('Data imported successfully!');
        } catch (error) {
            showError('Error importing data. Please check the file format.');
        }
    };
    reader.readAsText(file);
}

// Add event listeners for keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                saveToLocalStorage();
                showSuccess('Data saved locally!');
                break;
            case 'e':
                e.preventDefault();
                exportData();
                break;
        }
    }
});

// Add some sample data for demonstration
function addSampleData() {
    if (financialData.expenses.length === 0) {
        financialData.expenses.push({
            amount: 1200,
            category: 'housing',
            date: new Date().toISOString().split('T')[0],
            description: 'Monthly rent',
            createdAt: new Date().toISOString()
        });
    }
    
    if (financialData.income.length === 0) {
        financialData.income.push({
            amount: 4500,
            source: 'salary',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        });
    }
    
    saveToLocalStorage();
    updateExpenseList();
    updateIncomeList();
    updateDashboard();
}

// Call sample data on first load
setTimeout(addSampleData, 1000);
