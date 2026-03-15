class SplitWiseApp {

    constructor() {
        this.friends = [];
        this.expenses = [];

        // Works for localhost, 127.0.0.1, and deployed apps
        const host = window.location.hostname;

        if (host === "localhost" || host === "127.0.0.1") {
            this.API_BASE = "http://localhost:3000/api";
        } else {
            this.API_BASE = "/api";
        }

        this.init();
    }

    async init() {
        await this.loadData();
        this.bindEvents();
        this.render();
    }

    bindEvents() {

        document.getElementById('expenseForm')
            .addEventListener('submit', (e) => this.addExpense(e));

        document.getElementById('friendForm')
            .addEventListener('submit', (e) => this.addFriend(e));

        document.getElementById('addFriendBtn')
            .addEventListener('click', () => this.showModal());

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.hideModal());
        });

        document.getElementById('friendModal')
            .addEventListener('click', (e) => {
                if (e.target === e.currentTarget) this.hideModal();
            });
    }

    async apiRequest(endpoint, options = {}) {

        try {

            const response = await fetch(`${this.API_BASE}${endpoint}`, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {

            console.error('API Error:', error);

            this.fallbackToLocalStorage();

            throw error;
        }
    }

    async loadData() {

        try {

            const data = await this.apiRequest('/data');

            this.friends = data.friends || [];
            this.expenses = data.expenses || [];

        } catch (error) {

            console.log('Using localStorage fallback');

            this.loadLocalFallback();
        }
    }

    loadLocalFallback() {

        this.friends =
            JSON.parse(localStorage.getItem('splitwiseFriends')) || [];

        this.expenses =
            JSON.parse(localStorage.getItem('splitwiseExpenses')) || [];
    }

    async addFriend(e) {

        e.preventDefault();

        const name = document.getElementById('friendName').value.trim();

        if (!name || this.friends.includes(name)) {
            alert('Please enter a unique name!');
            return;
        }

        try {

            await this.apiRequest('/friends', {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            await this.loadData();

            document.getElementById('friendForm').reset();

            this.hideModal();

            this.render();

        } catch (error) {

            alert('Failed to add friend: ' + error.message);
        }
    }

    async addExpense(e) {

        e.preventDefault();

        const desc = document.getElementById('expenseDesc').value.trim();

        const amount = parseFloat(
            document.getElementById('expenseAmount').value
        );

        const paidBy = document.getElementById('paidBy').value;

        const selectedFriends =
            Array.from(document.querySelectorAll('.friend-item.selected'))
                .map(item => item.dataset.name);

        if (!desc || !amount || !paidBy || selectedFriends.length === 0) {
            alert('Please fill all fields and select at least one friend!');
            return;
        }

        try {

            await this.apiRequest('/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    description: desc,
                    amount,
                    paidBy,
                    participants: selectedFriends
                })
            });

            document.getElementById('expenseForm').reset();

            document.querySelectorAll('.friend-item.selected')
                .forEach(item => item.classList.remove('selected'));

            await this.loadData();

            this.render();

        } catch (error) {

            alert('Failed to add expense: ' + error.message);
        }
    }

    async deleteFriend(name) {

        if (!confirm(`Remove ${name}?`)) return;

        try {

            await this.apiRequest(
                `/friends/${encodeURIComponent(name)}`,
                { method: 'DELETE' }
            );

            await this.loadData();

            this.render();

        } catch (error) {

            alert('Failed to remove friend: ' + error.message);
        }
    }

    toggleFriendSelection(friendName) {

        const friendItem =
            document.querySelector(`[data-name="${friendName}"]`);

        if (friendItem) {
            friendItem.classList.toggle('selected');
        }
    }

    calculateBalances() {

        const balances = {};

        this.friends.forEach(friend => balances[friend] = 0);

        this.expenses.forEach(expense => {

            if (!expense.participants?.length) return;

            const share = expense.amount / expense.participants.length;

            balances[expense.paidBy] += share;

            expense.participants.forEach(participant => {

                if (participant !== expense.paidBy) {

                    balances[participant] -= share;
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
                <div style="text-align:center;padding:40px;color:#666;">
                    <i class="fas fa-users" style="font-size:3rem;margin-bottom:16px;opacity:0.5;"></i>
                    <p>No friends yet. Add some to get started!</p>
                </div>
            `;

            return;
        }

        container.innerHTML = this.friends.map(friend => `
            <div class="friend-item" data-name="${friend}"
            onclick="app.toggleFriendSelection('${friend}')">

                <span>${this.escapeHtml(friend)}</span>

                <button class="delete-btn"
                onclick="event.stopPropagation();app.deleteFriend('${friend}')">

                    <i class="fas fa-trash"></i>

                </button>

            </div>
        `).join('');
    }

    renderPaidBySelect() {

        const select = document.getElementById('paidBy');

        select.innerHTML =
            '<option value="">Choose who paid...</option>';

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
                <div style="text-align:center;padding:40px;color:#666;">
                    <i class="fas fa-receipt" style="font-size:3rem;margin-bottom:16px;opacity:0.5;"></i>
                    <p>No expenses yet. Add your first one!</p>
                </div>
            `;

            return;
        }

        container.innerHTML = recent.map(expense => {

            const date = expense.date
                ? new Date(expense.date).toLocaleDateString()
                : new Date().toLocaleDateString();

            const numPeople = expense.participants?.length || 0;

            return `
                <div class="expense-item">

                    <div class="expense-info">

                        <div class="expense-desc">
                            ${this.escapeHtml(expense.description)}
                        </div>

                        <div class="expense-meta">
                            <i class="fas fa-user-check"></i>
                            Paid by <strong>${this.escapeHtml(expense.paidBy)}</strong>
                            • ${numPeople} ${numPeople === 1 ? 'person' : 'people'}
                            • ${date}
                        </div>

                    </div>

                    <div class="expense-amount">
                        ₹${expense.amount.toFixed(2)}
                    </div>

                </div>
            `;
        }).join('');
    }

    renderBalances() {

        const balances = this.calculateBalances();

        const container = document.getElementById('balanceList');

        const balanceEntries =
            Object.entries(balances)
                .filter(([_, balance]) => Math.abs(balance) > 0.01)
                .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

        if (balanceEntries.length === 0) {

            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:#28a745;">
                    <i class="fas fa-check-circle" style="font-size:4rem;margin-bottom:16px;"></i>
                    <h4>🎉 Perfectly Balanced!</h4>
                    <p>Everyone has settled up</p>
                </div>
            `;

            return;
        }

        container.innerHTML = balanceEntries.map(([name, balance]) => {

            const isPositive = balance > 0;

            const absBalance = Math.abs(balance).toFixed(2);

            const className =
                isPositive ? 'balance-positive' : 'balance-negative';

            const status =
                isPositive ? 'is owed' : 'owes';

            return `
                <div class="balance-item ${className}">

                    <span>${this.escapeHtml(name)} ${status}</span>

                    <strong>
                        ${isPositive ? '+' : '-'}₹${absBalance}
                    </strong>

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

    escapeHtml(text) {

        const div = document.createElement('div');

        div.textContent = text;

        return div.innerHTML;
    }

    fallbackToLocalStorage() {

        localStorage.setItem(
            'splitwiseFriends',
            JSON.stringify(this.friends)
        );

        localStorage.setItem(
            'splitwiseExpenses',
            JSON.stringify(this.expenses)
        );
    }
}

document.addEventListener('DOMContentLoaded', () => {

    window.app = new SplitWiseApp();

});
