// ==UserScript==
// @name         BGG Random Game Selector
// @namespace    http://tampermonkey.net/
// @version      2.14
// @description  Randomly select a board game from your BGG collection and open its page in the same tab with an options menu on right-click
// @match        https://boardgamegeek.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Load the bias options from local storage or set default to true
    let recencyBias = JSON.parse(localStorage.getItem('recencyBias')) ?? true;
    let totalPlaysBias = JSON.parse(localStorage.getItem('totalPlaysBias')) ?? true;

    /**
     * Create and style the "Random!" button
     */
    function createButton() {
        const button = document.createElement('button');
        button.innerHTML = 'Random!';
        button.id = 'randomGameSelectorButton';
        button.style.backgroundColor = 'transparent';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.style.fontWeight = 'bold';
        button.style.padding = '0';
        button.style.marginLeft = '20px';
        return button;
    }

    /**
     * Create and style the options menu with checkboxes for recency and total plays biases
     */
    function createOptionsMenu() {
        const menu = document.createElement('div');
        menu.id = 'optionsMenu';
        menu.style.position = 'absolute';
        menu.style.display = 'none';
        menu.style.backgroundColor = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        menu.style.zIndex = '1000';
        menu.style.padding = '10px';

        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        title.innerText = 'Options';

        const recencyOption = document.createElement('div');
        const recencyCheckbox = document.createElement('input');
        recencyCheckbox.type = 'checkbox';
        recencyCheckbox.id = 'recencyCheckbox';
        recencyCheckbox.checked = recencyBias;
        recencyCheckbox.addEventListener('change', () => {
            recencyBias = recencyCheckbox.checked;
            localStorage.setItem('recencyBias', JSON.stringify(recencyBias)); // Save the recency option to local storage
        });

        const recencyLabel = document.createElement('label');
        recencyLabel.htmlFor = 'recencyCheckbox';
        recencyLabel.innerText = 'Recency Bias';

        recencyOption.appendChild(recencyCheckbox);
        recencyOption.appendChild(recencyLabel);

        const totalPlaysOption = document.createElement('div');
        const totalPlaysCheckbox = document.createElement('input');
        totalPlaysCheckbox.type = 'checkbox';
        totalPlaysCheckbox.id = 'totalPlaysCheckbox';
        totalPlaysCheckbox.checked = totalPlaysBias;
        totalPlaysCheckbox.addEventListener('change', () => {
            totalPlaysBias = totalPlaysCheckbox.checked;
            localStorage.setItem('totalPlaysBias', JSON.stringify(totalPlaysBias)); // Save the total plays option to local storage
        });

        const totalPlaysLabel = document.createElement('label');
        totalPlaysLabel.htmlFor = 'totalPlaysCheckbox';
        totalPlaysLabel.innerText = 'Total Plays Bias';

        totalPlaysOption.appendChild(totalPlaysCheckbox);
        totalPlaysOption.appendChild(totalPlaysLabel);

        menu.appendChild(title);
        menu.appendChild(recencyOption);
        menu.appendChild(totalPlaysOption);

        document.body.appendChild(menu);
    }

    /**
     * Show the options menu at the cursor location
     * @param {Event} event - The right-click event
     */
    function showOptionsMenu(event) {
        const menu = document.getElementById('optionsMenu');
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        menu.style.display = 'block';
        event.preventDefault();
    }

    /**
     * Hide the options menu
     */
    function hideOptionsMenu() {
        const menu = document.getElementById('optionsMenu');
        menu.style.display = 'none';
    }

    /**
     * Add the "Random!" button and options menu to the global header
     */
    function addButtonAndMenu() {
        const targetContainer = document.querySelector('ul.global-header-nav-primary');

        if (targetContainer) {
            const button = createButton();
            const listItem = document.createElement('li');
            listItem.className = 'global-header-nav-primary__item';
            listItem.appendChild(button);
            targetContainer.appendChild(listItem);

            button.addEventListener('click', main);
            button.addEventListener('contextmenu', showOptionsMenu);

            createOptionsMenu();
            document.addEventListener('click', hideOptionsMenu);
        } else {
            console.log('Target container not found, retrying...');
            setTimeout(addButtonAndMenu, 1000); // Retry after 1 second
        }
    }

    /**
     * Load local data from localStorage
     * @returns {Object|null} The parsed local data or null if not found
     */
    function loadLocalData() {
        const data = localStorage.getItem('bgg_collection');
        console.log('Loaded data from localStorage:', data);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Save data to localStorage
     * @param {Object} data - The data to save
     */
    function saveLocalData(data) {
        console.log('Saving data to localStorage:', data);
        localStorage.setItem('bgg_collection', JSON.stringify(data));
    }

    /**
     * Fetch user board games from BGG API
     * @param {string} username - The BGG username
     * @returns {Promise<Array>} The user's board games
     */
    async function getUserBoardgames(username) {
        const url = `https://www.boardgamegeek.com/xmlapi2/collection?username=${username}&own=1&excludesubtype=boardgameexpansion&stats=1`;
        let response, data;

        try {
            while (true) {
                response = await fetch(url);
                if (response.status === 200) {
                    data = await response.text();
                    break;
                } else if (response.status === 202) {
                    console.log("Request is queued, retrying in 10 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    throw new Error(`Error fetching data from BGG API: ${response.status}`);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch user board games: ${error.message}`);
            alert(`Failed to fetch user board games. Please try again later.`);
            throw error;
        }

        const parser = new DOMParser();
        const xml = parser.parseFromString(data, 'application/xml');
        const items = xml.getElementsByTagName('item');
        const games = [];

        for (let item of items) {
            const gameId = item.getAttribute('objectid');
            const gameName = item.getElementsByTagName('name')[0].textContent;
            const numPlays = parseInt(item.getElementsByTagName('numplays')[0].textContent);
            const lastPlayed = item.getElementsByTagName('lastmodified')[0]?.textContent || null;

            games.push({
                id: gameId,
                name: gameName,
                num_plays: numPlays,
                last_played: lastPlayed
            });
        }

        console.log('Fetched user boardgames:', games);
        return games;
    }

    /**
     * Calculate time factor for game selection
     * @param {string|null} lastPlayed - The last played date
     * @returns {number} The time factor
     */
    function calculateTimeFactor(lastPlayed) {
        if (!lastPlayed) {
            return 0;
        }
        const lastPlayedDate = new Date(lastPlayed);
        const daysSinceLastPlayed = Math.floor((new Date() - lastPlayedDate) / (1000 * 60 * 60 * 24));
        return daysSinceLastPlayed;
    }

    /**
     * Calculate frequency factor for game selection
     * @param {number} numPlays - The number of plays
     * @returns {number} The frequency factor
     */
    function calculateFrequencyFactor(numPlays) {
        return 1 / (numPlays + 1);
    }

    /**
     * Calculate recency score for game selection
     * @param {string|null} lastPlayed - The last played date
     * @returns {number} The recency score
     */
    function calculateRecencyScore(lastPlayed) {
        const timeFactor = calculateTimeFactor(lastPlayed);
        const randomFactor = Math.random() * 0.1;  // Adding a small random factor
        return timeFactor + randomFactor;
    }

    /**
     * Calculate total plays score for game selection
     * @param {number} numPlays - The number of plays
     * @returns {number} The total plays score
     */
    function calculateTotalPlaysScore(numPlays) {
        const frequencyFactor = calculateFrequencyFactor(numPlays);
        const randomFactor = Math.random() * 0.1;  // Adding a small random factor
        return frequencyFactor + randomFactor;
    }

    /**
     * Calculate combined score for game selection with more weight on recency
     * @param {string|null} lastPlayed - The last played date
     * @param {number} numPlays - The number of plays
     * @returns {number} The combined score
     */
    function calculateCombinedScore(lastPlayed, numPlays) {
        const timeFactor = calculateTimeFactor(lastPlayed);
        const frequencyFactor = calculateFrequencyFactor(numPlays);
        const randomFactor = Math.random() * 0.1;  // Adding a small random factor
        return (0.7 * timeFactor) + (0.3 * frequencyFactor) + randomFactor;
    }

    /**
     * Select game based on recency bias
     * @param {Array} games - The list of games
     * @returns {Object|null} The selected game
     */
    function selectRecencyBiasedGame(games) {
        let bestScore = -1;
        let selectedGame = null;

        for (let game of games) {
            const score = calculateRecencyScore(game.last_played);
            if (score > bestScore) {
                bestScore = score;
                selectedGame = game;
                localStorage.setItem('selectedGameScore', score); // Save selected game score to localStorage
            }
        }

        return selectedGame;
    }

    /**
     * Select game based on total plays bias
     * @param {Array} games - The list of games
     * @returns {Object|null} The selected game
     */
    function selectTotalPlaysBiasedGame(games) {
        let bestScore = -1;
        let selectedGame = null;

        for (let game of games) {
            const score = calculateTotalPlaysScore(game.num_plays);
            if (score > bestScore) {
                bestScore = score;
                selectedGame = game;
                localStorage.setItem('selectedGameScore', score); // Save selected game score to localStorage
            }
        }

        return selectedGame;
    }

    /**
     * Select game based on combined score
     * @param {Array} games - The list of games
     * @returns {Object|null} The selected game
     */
    function selectCombinedBiasedGame(games) {
        let bestScore = -1;
        let selectedGame = null;

        for (let game of games) {
            const score = calculateCombinedScore(game.last_played, game.num_plays);
            if (score > bestScore) {
                bestScore = score;
                selectedGame = game;
                localStorage.setItem('selectedGameScore', score); // Save selected game score to localStorage
            }
        }

        return selectedGame;
    }

    /**
     * Randomly select one game without bias
     * @param {Array} games - The list of games
     * @returns {Object} The selected game
     */
    function randomlySelectGame(games) {
        const randomIndex = Math.floor(Math.random() * games.length);
        const selectedGame = games[randomIndex];
        const score = recencyBias ? calculateRecencyScore(selectedGame.last_played) : calculateTotalPlaysScore(selectedGame.num_plays);
        localStorage.setItem('selectedGameScore', score); // Save selected game score to localStorage
        return selectedGame;
    }

    /**
     * Extract logged-in username from the page
     * @returns {string|null} The logged-in username or null if not found
     */
    function getLoggedInUsername() {
        const userElement = document.querySelector('a[href*="/user/"]');
        if (userElement) {
            const userUrl = userElement.getAttribute('href');
            return userUrl.split('/user/')[1];
        }
        return null;
    }

    /**
     * Main function to handle user interaction and game selection
     */
    async function main() {
        const localData = loadLocalData();
        const loggedInUsername = getLoggedInUsername();

        if (!loggedInUsername) {
            alert("Could not detect logged-in user. Please log in to BoardGameGeek.");
            return;
        }

        const lastUsername = localData?.username;
        const username = loggedInUsername || prompt(`Enter your BoardGameGeek username [${lastUsername}]`, lastUsername) || lastUsername;

        if (!username) {
            alert("Username is required.");
            return;
        }

        try {
            let games;
            if (localData && localData.username === username) {
                const lastUpdate = localData.last_update;
                console.log(`Using local data last updated on ${lastUpdate}`);
                games = localData.games;
            } else {
                games = await getUserBoardgames(username);
                console.log('Saving user collection to local storage');
                saveLocalData({
                    username: username,
                    last_update: new Date().toISOString(),
                    games: games
                });
            }

            console.log('User collection:', games);
            console.log('User collection IDs:', games.map(g => g.id)); // Log all game IDs in the user's collection

            if (games.length === 0) {
                alert("No games found in your collection.");
                return;
            }

            let selectedGame;
            if (recencyBias && totalPlaysBias) {
                selectedGame = selectCombinedBiasedGame(games);
            } else if (recencyBias) {
                selectedGame = selectRecencyBiasedGame(games);
            } else if (totalPlaysBias) {
                selectedGame = selectTotalPlaysBiasedGame(games);
            } else {
                selectedGame = randomlySelectGame(games);
            }

            if (selectedGame) {
                const gameUrl = `https://boardgamegeek.com/boardgame/${selectedGame.id}`;
                window.location.href = gameUrl;
            } else {
                alert("No game selected.");
            }

        } catch (e) {
            console.error(`An error occurred: ${e.message}`);
            alert(`An error occurred: ${e.message}`);
        }
    }

    /**
     * Check if the current page is a game page
     * @returns {boolean} True if it is a game page, otherwise false
     */
    function isGamePage() {
        return /\/boardgame\/\d+/.test(window.location.pathname);
    }

    /**
     * Get the game ID from the URL
     * @returns {string|null} The game ID or null if not found
     */
    function getGameIdFromUrl() {
        const match = window.location.pathname.match(/\/boardgame\/(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Add custom CSS to ensure the "Selection Score" is displayed correctly
     */
    function addCustomCSS() {
        const css = `
            .game-header-primary-actions .selection-score {
                font-family: "Open Sans", sans-serif;
                font-size: 14px;
                font-weight: 700;
                color: #777;
                display: block;
                margin-bottom: 10px;
            }
        `;
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    /**
     * Add the Selection Score to the primary actions section
     * @param {number} score - The selection score
     */
    function addSelectionScore(score) {
        const actionsSection = document.querySelector('.game-header-primary-actions.hidden-game-header-collapsed');
        if (actionsSection) {
            console.log('Found actions section');
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'selection-score';
            scoreSpan.textContent = `Selection Score: ${score.toFixed(2)}`;

            // Append the scoreSpan directly to the actionsSection
            actionsSection.appendChild(scoreSpan);
        } else {
            console.log('Did not find actions section');
        }
    }

    /**
     * Add selection score if the page is a game page and the game is in the user's collection
     */
    function addSelectionScoreIfGamePage() {
        if (isGamePage()) {
            const gameId = getGameIdFromUrl();
            console.log(`Game ID from URL: ${gameId}`);
            const gameIdStr = String(gameId); // Ensure the game ID from URL is treated as a string
            const localData = loadLocalData();
            const games = localData ? localData.games : [];
            console.log('User collection IDs:', games.map(g => g.id)); // Log all game IDs in the user's collection
            games.forEach(g => console.log(g.id, g.name)); // Log each game ID and name in the collection for detailed inspection
            const game = games.find(g => g.id === gameIdStr); // Compare with string
            if (game) {
                console.log(`Game found in collection: ${game.name}`);
                const score = localStorage.getItem('selectedGameScore'); // Get the selection score from localStorage
                addSelectionScore(parseFloat(score));
            } else {
                console.log('Game not found in user collection');
            }
        } else {
            console.log('Not a game page');
        }
    }

    // Add custom CSS to ensure the "Selection Score" is displayed correctly
    addCustomCSS();

    // Add button and options menu after the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', addButtonAndMenu);

    // Add selection score if on a game page
    window.addEventListener('load', addSelectionScoreIfGamePage);

})();
