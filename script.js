class RPSLSGame {
    constructor() {
        this.gameState = {
            player1: { name: 'Player 1', score: 0, choice: null },
            player2: { name: 'Computer', score: 0, choice: null },
            currentRound: 1,
            totalRounds: 5,
            gameMode: 'pvc', // pvc or pvp
            gameVariant: 'extended', // classic or extended
            timer: 10,
            soundEnabled: true,
            gameActive: false,
            waitingForPlayer2: false
        };
        
        this.choices = {
            classic: ['rock', 'paper', 'scissors'],
            extended: ['rock', 'paper', 'scissors', 'lizard', 'spock']
        };
        
        this.choiceEmojis = {
            rock: '🗿', paper: '📄', scissors: '✂️', lizard: '🦎', spock: '🖖'
        };
        
        this.rules = {
            rock: ['lizard', 'scissors'],
            paper: ['rock', 'spock'],
            scissors: ['paper', 'lizard'],
            lizard: ['spock', 'paper'],
            spock: ['scissors', 'rock']
        };

        // --- NEW: Player history for AI ---
        this.playerHistory = [];
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.leaderboard = JSON.parse(localStorage.getItem('rpsls-leaderboard') || '[]');
        this.timerInterval = null;
        this.currentTimer = 0;
        
        this.cacheDOMElements();
        this.initializeEventListeners();
        this.updateDisplay();
        this.loadLeaderboard();
        this.updateChoicesDisplay();
    }

    cacheDOMElements() {
        this.dom = {
            player1NameInput: document.getElementById('player1Name'),
            player2NameInput: document.getElementById('player2Name'),
            displayPlayer1: document.getElementById('displayPlayer1'),
            displayPlayer2: document.getElementById('displayPlayer2'),
            player1Choice: document.getElementById('player1Choice'),
            player2Choice: document.getElementById('player2Choice'),
            scorePlayer1: document.getElementById('scorePlayer1'),
            scorePlayer2: document.getElementById('scorePlayer2'),
            currentRound: document.getElementById('currentRound'),
            totalRounds: document.getElementById('totalRounds'),
            timerDisplay: document.getElementById('timerDisplay'),
            resultMessage: document.getElementById('resultMessage'),
            leaderboardList: document.getElementById('leaderboardList'),
            victoryModal: document.getElementById('victoryModal'),
            victoryTitle: document.getElementById('victoryTitle'),
            victoryMessage: document.getElementById('victoryMessage'),
            nextRoundBtn: document.getElementById('nextRoundBtn'),
            gameVariantSelect: document.getElementById('gameVariant'),
            roundsSelect: document.getElementById('rounds'),
            timerSelect: document.getElementById('timer'),
            soundEnabledCheckbox: document.getElementById('soundEnabled'),
            choiceBtns: document.querySelectorAll('.choice-btn'),
            modeBtns: document.querySelectorAll('.mode-btn')
        };
    }
    
    initializeEventListeners() {
        document.getElementById('startGame').addEventListener('click', () => this.startNewGame());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        this.dom.nextRoundBtn.addEventListener('click', () => this.nextRound());
        
        this.dom.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.modeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.gameState.gameMode = e.target.dataset.mode;
                this.updatePlayer2NameInput();
            });
        });
        
        this.dom.gameVariantSelect.addEventListener('change', (e) => {
            this.gameState.gameVariant = e.target.value;
            this.updateChoicesDisplay();
        });

        this.dom.choiceBtns.forEach(btn => {
            btn.addEventListener('click', () => this.makeChoice(btn.dataset.choice));
        });
        
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.closeModal();
            this.startNewGame();
        });
    }
    
    updatePlayer2NameInput() {
        if (this.gameState.gameMode === 'pvc') {
            this.dom.player2NameInput.value = 'Computer';
            this.dom.player2NameInput.disabled = true;
        } else {
            this.dom.player2NameInput.value = 'Player 2';
            this.dom.player2NameInput.disabled = false;
        }
    }
    
    updateChoicesDisplay() {
        const currentChoices = this.choices[this.gameState.gameVariant];
        this.dom.choiceBtns.forEach(btn => {
            if (currentChoices.includes(btn.dataset.choice)) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        });
    }
    
    startNewGame() {
        this.gameState.player1.score = 0;
        this.gameState.player2.score = 0;
        this.gameState.currentRound = 1;
        this.gameState.gameActive = true;
        this.gameState.waitingForPlayer2 = false;
        this.playerHistory = []; // Reset AI memory
        
        this.gameState.player1.name = this.dom.player1NameInput.value || 'Player 1';
        this.gameState.player2.name = this.dom.player2NameInput.value || (this.gameState.gameMode === 'pvc' ? 'Computer' : 'Player 2');
        this.gameState.totalRounds = parseInt(this.dom.roundsSelect.value);
        this.gameState.timer = parseInt(this.dom.timerSelect.value);
        this.gameState.soundEnabled = this.dom.soundEnabledCheckbox.checked;
        
        this.resetRound();
        this.updateDisplay();
        this.closeModal();
        this.playSound('start');
        this.showMessage(`Round 1! Make your choice, ${this.gameState.player1.name}.`, 'result-tie');
    }
    
    resetGame() {
        this.gameState.gameActive = false;
        this.gameState.waitingForPlayer2 = false;
        this.clearTimer();
        this.resetRound();
        this.dom.resultMessage.classList.add('hidden');
    }
    
    resetRound() {
        this.gameState.player1.choice = null;
        this.gameState.player2.choice = null;
        this.dom.player1Choice.textContent = '❓';
        this.dom.player2Choice.textContent = '❓';
        this.dom.player1Choice.className = 'player-choice';
        this.dom.player2Choice.className = 'player-choice';
        this.dom.nextRoundBtn.classList.add('hidden');
        
        this.dom.choiceBtns.forEach(btn => btn.classList.remove('selected'));

        if (this.gameState.gameActive) {
            this.startTimer();
        }
    }
    
    makeChoice(choice) {
        if (!this.gameState.gameActive) return;
        
        this.playSound('click');

        if (this.gameState.gameMode === 'pvp' && this.gameState.waitingForPlayer2) {
            this.gameState.player2.choice = choice;
            this.dom.player2Choice.textContent = this.choiceEmojis[choice];
            this.gameState.waitingForPlayer2 = false;
            this.resolveRound();
        } else {
            this.gameState.player1.choice = choice;
            this.dom.player1Choice.textContent = this.choiceEmojis[choice];
            
            if (this.gameState.gameMode === 'pvc') {
                this.makeSmarterComputerChoice();
            } else { 
                this.gameState.waitingForPlayer2 = true;
                this.clearTimer();
                this.showMessage(`Your turn, ${this.gameState.player2.name}!`, 'result-tie');
                this.startTimer();
            }
        }
    }

    // --- NEW: AI-powered choice method ---
    makeSmarterComputerChoice() {
        const choices = this.choices[this.gameState.gameVariant];
        let computerChoice;

        // AI logic: Try to predict and counter the player's next move
        if (this.playerHistory.length > 3) {
            const lastMove = this.playerHistory[this.playerHistory.length - 1];
            const nextMovePredictions = {};

            for (let i = 0; i < this.playerHistory.length - 1; i++) {
                if (this.playerHistory[i] === lastMove) {
                    const nextMove = this.playerHistory[i + 1];
                    nextMovePredictions[nextMove] = (nextMovePredictions[nextMove] || 0) + 1;
                }
            }

            const predictedMove = Object.keys(nextMovePredictions).reduce((a, b) => nextMovePredictions[a] > nextMovePredictions[b] ? a : b, null);

            if (predictedMove) {
                // Find a move that beats the predicted move
                computerChoice = choices.find(choice => this.rules[choice].includes(predictedMove));
            }
        }

        // Fallback to random if no pattern is found or not enough history
        if (!computerChoice) {
            computerChoice = choices[Math.floor(Math.random() * choices.length)];
        }
        
        this.animateComputerChoice(() => {
            this.gameState.player2.choice = computerChoice;
            this.dom.player2Choice.textContent = this.choiceEmojis[computerChoice];
            this.resolveRound();
        });
    }
    
    animateComputerChoice(callback) {
        let count = 0;
        const choices = this.choices[this.gameState.gameVariant];
        const interval = setInterval(() => {
            const randomEmoji = this.choiceEmojis[choices[Math.floor(Math.random() * choices.length)]];
            this.dom.player2Choice.textContent = randomEmoji;
            count++;
            
            if (count >= 10) {
                clearInterval(interval);
                setTimeout(callback, 200);
            }
        }, 100);
    }
    
    // --- UPDATED: resolveRound with player history tracking ---
    resolveRound() {
        const p1Choice = this.gameState.player1.choice;
        const p2Choice = this.gameState.player2.choice;
        
        if (!p1Choice || !p2Choice) return;

        // Add to player history for AI learning
        this.playerHistory.push(p1Choice);
        if (this.playerHistory.length > 20) {
            this.playerHistory.shift(); // Keep only last 20 moves
        }
        
        this.clearTimer();
        
        if (p1Choice === p2Choice) {
            this.showMessage("It's a tie!", 'result-tie');
        } else if (this.rules[p1Choice].includes(p2Choice)) {
            this.gameState.player1.score++;
            this.dom.player1Choice.classList.add('winner');
            this.dom.player2Choice.classList.add('loser');
            this.showMessage(`${this.gameState.player1.name} wins the round!`, 'result-win');
            this.playSound('win');
        } else {
            this.gameState.player2.score++;
            this.dom.player2Choice.classList.add('winner');
            this.dom.player1Choice.classList.add('loser');
            this.showMessage(`${this.gameState.player2.name} wins the round!`, 'result-lose');
            this.playSound('lose');
        }
        
        this.updateDisplay();
        
        const maxScore = Math.ceil(this.gameState.totalRounds / 2);
        if (this.gameState.player1.score >= maxScore || this.gameState.player2.score >= maxScore) {
            this.endGame();
        } else {
            this.dom.nextRoundBtn.classList.remove('hidden');
        }
    }
    
    nextRound() {
        this.gameState.currentRound++;
        this.resetRound();
        this.updateDisplay();
        this.showMessage(`Round ${this.gameState.currentRound}! Make your choice, ${this.gameState.player1.name}.`, 'result-tie');
    }
    
    endGame() {
        this.gameState.gameActive = false;
        const winner = this.gameState.player1.score > this.gameState.player2.score ? 
            this.gameState.player1.name : this.gameState.player2.name;
        
        this.addToLeaderboard(winner);
        
        this.dom.victoryTitle.textContent = '🎉 Game Over!';
        this.dom.victoryMessage.textContent = 
            `${winner} wins the game! Final score: ${this.gameState.player1.score} - ${this.gameState.player2.score}`;
        this.dom.victoryModal.style.display = 'block';
        this.playSound('gameOver');
    }
    
    startTimer() {
        if (this.gameState.timer === 0 || !this.gameState.gameActive) return;
        this.clearTimer();
        this.currentTimer = this.gameState.timer;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.currentTimer--;
            this.updateTimerDisplay();
            
            if(this.currentTimer <= 3 && this.currentTimer > 0) {
                this.playSound('tick');
            }

            if (this.currentTimer <= 0) {
                this.handleTimeOut();
            }
        }, 1000);
    }

    handleTimeOut() {
        this.clearTimer();
        const currentPlayer = this.gameState.waitingForPlayer2 ? this.gameState.player2 : this.gameState.player1;
        const otherPlayer = this.gameState.waitingForPlayer2 ? this.gameState.player1 : this.gameState.player2;
        
        this.showMessage(`${currentPlayer.name} ran out of time! ${otherPlayer.name} wins the round.`, 'result-lose');
        otherPlayer.score++;
        this.playSound('timeout');
        
        const maxScore = Math.ceil(this.gameState.totalRounds / 2);
        if (otherPlayer.score >= maxScore) {
            this.endGame();
        } else {
            this.dom.nextRoundBtn.classList.remove('hidden');
        }
        this.updateDisplay();
    }

    clearTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.dom.timerDisplay.textContent = '';
        this.dom.timerDisplay.classList.remove('countdown');
    }
    
    updateTimerDisplay() {
        if(this.currentTimer > 0) {
           this.dom.timerDisplay.textContent = this.currentTimer;
           this.dom.timerDisplay.className = this.currentTimer <= 3 ? 'timer-display countdown' : 'timer-display';
        }
    }

    updateDisplay() {
        this.dom.displayPlayer1.textContent = this.gameState.player1.name;
        this.dom.displayPlayer2.textContent = this.gameState.player2.name;
        this.dom.scorePlayer1.textContent = this.gameState.player1.score;
        this.dom.scorePlayer2.textContent = this.gameState.player2.score;
        this.dom.currentRound.textContent = this.gameState.currentRound;
        this.dom.totalRounds.textContent = this.gameState.totalRounds;
    }

    showMessage(message, type) {
        this.dom.resultMessage.textContent = message;
        this.dom.resultMessage.className = `result-message ${type}`;
        this.dom.resultMessage.classList.remove('hidden');
    }
    
    loadLeaderboard() {
        this.dom.leaderboardList.innerHTML = '';
        if (this.leaderboard.length === 0) {
            this.dom.leaderboardList.innerHTML = '<div class="leaderboard-item"><span>No games played yet</span></div>';
            return;
        }
        
        this.leaderboard
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 10)
            .forEach((entry, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                item.innerHTML = `
                    <div>
                        <div style="font-weight: bold;">${entry.name}</div>
                        <div style="font-size: 0.8rem; opacity: 0.8;">
                            ${entry.wins} wins • ${entry.date}
                        </div>
                    </div>
                    <div style="font-size: 1.2rem;">
                        ${index < 3 ? ['🥇', '🥈', '🥉'][index] : '🏆'}
                    </div>
                `;
                this.dom.leaderboardList.appendChild(item);
            });
    }

    addToLeaderboard(winnerName) {
        const existingEntry = this.leaderboard.find(entry => entry.name === winnerName);
        if (existingEntry) {
            existingEntry.wins++;
        } else {
            this.leaderboard.push({ name: winnerName, wins: 1, date: new Date().toLocaleDateString() });
        }
        localStorage.setItem('rpsls-leaderboard', JSON.stringify(this.leaderboard));
        this.loadLeaderboard();
    }

    closeModal() {
        this.dom.victoryModal.style.display = 'none';
    }

    playSound(type) {
        if (!this.gameState.soundEnabled || !this.audioContext) return;
        
        const sounds = {
            click: { freq: 400, duration: 0.1, type: 'triangle' },
            win: { freq: 600, duration: 0.3, type: 'sine' },
            lose: { freq: 200, duration: 0.4, type: 'square' },
            tick: { freq: 800, duration: 0.05, type: 'sine' },
            start: { freq: 300, duration: 0.2, type: 'sine' },
            gameOver: { freq: 700, duration: 0.5, type: 'sine' },
            timeout: { freq: 150, duration: 0.5, type: 'sawtooth'},
            error: { freq: 100, duration: 0.2, type: 'square' }
        };

        const sound = sounds[type];
        if (sound) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = sound.type;
            oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + sound.duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new RPSLSGame());