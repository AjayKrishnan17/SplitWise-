class SplitWiseApp {

    constructor() {
        this.friends = [];
        this.expenses = [];

        // API base
        this.API_BASE = "/api";

        this.init();
    }

    async init() {

        this.updateStatus('🔄 Loading from MongoDB...');

        await this.loadData();

        this.bindEvents();

        this.updateStatus(`✅ Ready - ${this.friends.length} friends`);

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

        const response = await fetch(`${this.API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return await response.json();
    }

    async loadData() {

        try {

            const data = await this.apiRequest('/data');

            this.friends = data.friends || [];
            this.expenses = data.expenses || [];

            this.saveLocalBackup();

        } catch (error) {

            console.log('Using localStorage fallback');

            this.friends =
                JSON.parse(localStorage.getItem('splitwiseFriends')) || [];

            this.expenses =
                JSON.parse(localStorage.getItem('splitwiseExpenses')) || [];
        }
    }

    saveLocalBackup() {

        localStorage.setItem(
            'splitwiseFriends',
            JSON.stringify(this.friends)
        );

        localStorage.setItem(
            'splitwiseExpenses',
            JSON.stringify(this.expenses)
        );
    }

    updateStatus(message) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = message;
        }
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

            document.getElementById('friendForm').reset();

            this.hideModal();

            await this.loadData();

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

                <span>${friend}</span>

                <button class="delete-btn"
                onclick="event.stopPropagation();app.deleteFriend('${friend}')">

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
                <div style="text-align:center;padding:40px;color:#666;">
                    <i class="fas fa-receipt" style="font-size:3rem;margin-bottom:16px;opacity:0.5;"></i>
                    <p>No expenses yet. Add your first one!</p>
                </div>
            `;

            return;
        }

        container.innerHTML = recent.map(expense => {

            const date = new Date(expense.date).toLocaleDateString();

            return `
                <div class="expense-item">

                    <div class="expense-info">

                        <div class="expense-desc">
                            ${expense.description}
                        </div>

                        <div class="expense-meta">
                            Paid by <strong>${expense.paidBy}</strong>
                            • ${expense.participants.length} people
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

        container.innerHTML = Object.entries(balances).map(([name, balance]) => {

            const isPositive = balance > 0;

            return `
                <div class="balance-item ${isPositive ? 'balance-positive' : 'balance-negative'}">

                    <span>${name}</span>

                    <strong>
                        ${isPositive ? '+' : '-'}₹${Math.abs(balance).toFixed(2)}
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
}

document.addEventListener('DOMContentLoaded', () => {

    window.app = new SplitWiseApp();

});
