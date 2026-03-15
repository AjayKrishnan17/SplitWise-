class SplitWiseApp {
    constructor() {
        this.friends = JSON.parse(localStorage.getItem('splitwiseFriends')) || [];
        this.expenses = JSON.parse(localStorage.getItem('splitwiseExpenses')) || [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.saveData();
    }

    bindEvents() {
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.addExpense(e));
        document.getElementById('friendForm').addEventListener('submit', (e) => this.addFriend(e));
        document.getElementById('addFriendBtn').addEventListener('click', () => this.showModal());
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.hideModal());
        });
        
        document.getElementById('friendModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideModal();
        });
    }

    addFriend(e) {
        e.preventDefault();
        const name = document.getElementById('friendName').value.trim();
        
        if (!name || this.friends.includes(name)) {
            alert('Please enter a unique name!');
            return;
        }

        this.friends.push(name);
        document.getElementById('friendForm').reset();
        this.hideModal();
        this.render();
        this.saveData();
    }

    addExpense(e) {
        e.preventDefault();
        
        const desc = document.getElementById('expenseDesc').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const paidBy = document.getElementById('paidBy').value;
        const selectedFriends = Array.from(document.querySelectorAll('.friend-item.selected'))
                                   .map(item => item.dataset.name);

        if (!desc || !amount || !paidBy || selectedFriends.length === 0) {
            alert('Please fill all fields and select at least one friend!');
            return;
        }

        const expense = {
            id: Date.now(),
            description: desc,
            amount: amount,
            paidBy: paidBy,
            participants: selectedFriends,
            date: new Date().toISOString()
        };

        this.expenses.unshift(expense);
        document.getElementById('expenseForm').reset();
        document.querySelectorAll('.friend-item').forEach(item => item.classList.remove('selected'));
        
        this.render();
        this.saveData();
    }

    deleteFriend(name) {
        if (confirm(`Remove ${name}?`)) {
            this.friends = this.friends.filter(friend => friend !== name);
            this.expenses = this.expenses.filter(exp => 
                exp.paidBy !== name && !exp.participants.includes(name)
            );
            this.render();
            this.saveData();
        }
    }

    toggleFriendSelection(friendName) {
        const friendItem = document.querySelector(`[data-name="${friendName}"]`);
        if (friendItem) {
            friendItem.classList.toggle('selected');
        }
    }

    calculateBalances() {
        const balances = {};
        
        // Initialize all friends to 0
        this.friends.forEach(friend => balances[friend] = 0);

        // Process all expenses
        this.expenses.forEach(expense => {
            if (expense.participants.length === 0) return;
            
            const share = expense.amount / expense.participants.length;
            
            // Payer gets credited (positive balance)
            balances[expense.paidBy] = (balances[expense.paidBy] || 0) + share;
            
            // Participants owe money (negative balance)
            expense.participants.forEach(participant => {
                if (participant !== expense.paidBy) {
                    balances[participant] = (balances[participant] || 0) - share;
                }
            });
        });

        return balances;
    }

    render() {
        this.renderFriends();
        this.renderPaidBySelect();
        this.renderExpenses();
        this.renderBalances();
    }

    renderFriends() {
        const container = document.getElementById('friendsList');
        
        if (this.friends.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No friends yet. Add some to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.friends.map(friend => `
            <div class="friend-item" data-name="${friend.replace(/"/g, '&quot;')}" onclick="app.toggleFriendSelection('${friend.replace(/'/g, "\\'")}')">
                <span>${friend}</span>
                <button class="delete-btn" onclick="event.stopPropagation(); app.deleteFriend('${friend.replace(/'/g, "\\'")}')" title="Delete ${friend}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    renderPaidBySelect() {
        const select = document.getElementById('paidBy');
        select.innerHTML = '<option value="">Choose who paid...</option>';
        
        this.friends.forEach(friend => {
            const option = document.createElement('option');
            option.value = friend;
            option.textContent = friend;
            select.appendChild(option);
        });
    }

    renderExpenses() {
        const container = document.getElementById('expensesList');
        const recent = this.expenses.slice(0, 5);
        
        if (recent.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-receipt" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No expenses yet. Add your first one!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recent.map(expense => {
            const date = new Date(expense.date).toLocaleDateString();
            const numPeople = expense.participants.length;
            return `
                <div class="expense-item">
                    <div class="expense-info">
                        <div class="expense-desc">${this.escapeHtml(expense.description)}</div>
                        <div class="expense-meta">
                            <i class="fas fa-user-check"></i> Paid by <strong>${this.escapeHtml(expense.paidBy)}</strong> • 
                            <i class="fas fa-users"></i> ${numPeople} ${numPeople === 1 ? 'person' : 'people'} • 
                            ${date}
                        </div>
                    </div>
                    <div class="expense-amount">$${expense.amount.toFixed(2)}</div>
                </div>
            `;
        }).join('');
    }

    renderBalances() {
        const balances = this.calculateBalances();
        const container = document.getElementById('balanceList');
        
        // Filter out zero balances
        const balanceEntries = Object.entries(balances)
            .filter(([_, balance]) => Math.abs(balance) > 0.01)
            .sort(([,a], [,b]) => Math.abs(b) - Math.abs(a));

        if (balanceEntries.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:#28a745;">
                    <i class="fas fa-check-circle" style="font-size:4rem;margin-bottom:16px;"></i>
                    <h4 style="margin-bottom:8px;">🎉 Perfectly Balanced!</h4>
                    <p>Everyone has settled up</p>
                </div>
            `;
            return;
        }

        container.innerHTML = balanceEntries.map(([name, balance]) => {
            const isPositive = balance > 0;
            const absBalance = Math.abs(balance).toFixed(2);
            const className = isPositive ? 'balance-positive' : 'balance-negative';
            const status = isPositive ? 'is owed' : 'owes';
            
            return `
                <div class="balance-item ${className}">
                    <div>
                        <span>${this.escapeHtml(name)} ${status}</span>
                    </div>
                    <div style="font-size:1.2rem;font-weight:bold;">
                        ${isPositive ? '+' : '-'}$${absBalance}
                    </div>
                </div>
            `;
        }).join('');
    }

    showModal() {
        document.getElementById('friendModal').style.display = 'flex';
        document.getElementById('friendName').focus();
    }

    hideModal() {
        document.getElementById('friendModal').style.display = 'none';
        document.getElementById('friendForm').reset();
    }

    saveData() {
        localStorage.setItem('splitwiseFriends', JSON.stringify(this.friends));
        localStorage.setItem('splitwiseExpenses', JSON.stringify(this.expenses));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SplitWiseApp();
});