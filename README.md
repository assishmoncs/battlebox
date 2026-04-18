# BattleBox

BattleBox is a professional multiplayer gaming platform featuring real-time competitive mini-games with a modern cyberpunk-inspired UI.

![Games](12) | ![Players](∞) | ![Latency](<10ms)

## Features

- **12 Multiplayer Mini-Games** across multiple categories
- **Real-time Gameplay** powered by Socket.IO
- **Professional Gaming UI** with neon cyberpunk aesthetic
- **Lobby Chat System** for player communication
- **Ready/Unready System** for game coordination
- **Rematch Functionality** for instant replay
- **Recent Rooms** for quick rejoining
- **Responsive Design** for desktop and mobile

## Game Categories

### Speed Games
- **Reaction Battle** - Test your reflexes, click when it turns green!
- **Speed Typing** - Race to type words correctly and fast
- **Color Match** - Stroop effect challenge (click the color, not the word)

### Strategy Games
- **Tic Tac Toe** - Classic 1v1 strategy game
- **Memory Match** - Find matching pairs in a 4x4 card grid
- **Simon Says** - Repeat the pattern, gets progressively harder

### Word Games
- **Word Chain** - Build a chain of words, each starting with the last letter
- **Anagram Sprint** - Unscramble words under time pressure

### Math Games
- **Math Duel** - Quick arithmetic challenges
- **Number Hunt** - Closest guess to the target number wins

### Classic Games
- **RPS Arena** - Rock Paper Scissors with multiple rounds

### Trivia Games
- **Trivia Challenge** - 15-question quiz with categories

## Project Structure

```
battlebox/
├── backend/
│   ├── server.js          # Express + Socket.IO server
│   └── package.json       # Server dependencies
├── frontend/
│   ├── index.html         # Landing page with game selection
│   ├── lobby.html         # Lobby with chat and player list
│   ├── game.html          # Active game interface
│   ├── style.css          # Professional gaming UI styles
│   ├── script.js          # Landing page logic
│   └── games.js           # Client-side game logic
└── games/                 # Server-side game modules
    ├── reaction.js
    ├── tictactoe.js
    ├── wordchain.js
    ├── mathduel.js
    ├── rpsarena.js
    ├── anagram.js
    ├── numberhunt.js
    ├── memorymatch.js
    ├── speedtyping.js
    ├── colormatch.js
    ├── simonsays.js
    └── trivia.js
```

## Requirements

- Node.js 18+ (recommended)
- npm or yarn

## Quick Start

1. **Install Dependencies**
   ```bash
   cd backend/
   npm install
   ```

2. **Start the Server**
   ```bash
   node server.js
   ```

3. **Open in Browser**
   Navigate to http://localhost:3000

## How To Play

1. **Enter your gamertag** on the landing page
2. **Select a game** from the 12 available options
3. **Create a room** or **join** with a 4-letter room code
4. **Share the code** with friends to invite them
5. **Mark as ready** (non-host players)
6. **Start the battle** when at least 2 players are ready

## Game Details

### Reaction Battle
Fast-paced reflex test. The circle turns red (wait), then green (click!). Fastest click wins the round. 5 rounds total.

### Speed Typing
Race against opponents to type displayed words. First to correctly type the word gets points. 10 words per game.

### Color Match
Stroop effect challenge! Click the button matching the COLOR of the text (not what the text says). 10 rounds.

### Memory Match
Flip cards to find matching emoji pairs. Find a match, get another turn. Most matches wins.

### Simon Says
Watch the pattern of colors, then repeat it. Pattern gets longer each round. Last player standing wins.

### Trivia Challenge
15 questions across various categories. Faster correct answers = more points. 15-second timer per question.

## Technical Features

- **Anti-cheat measures** in reaction game
- **Rate limiting** to prevent spam
- **Reconnection support** for dropped players
- **In-memory state** (resets on server restart)
- **Grace period** for accidental disconnections
- **Automatic room cleanup** for inactive rooms

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Adding a New Game

1. Create a game module in `games/yourgame.js`
2. Add the game to `backend/server.js` gameModules object
3. Add UI initialization in `frontend/games.js` initGameUI()
4. Add socket handler in `backend/server.js` startGame switch
5. Add game option to `frontend/index.html`

### Environment Variables

Create a `.env` file in the backend directory (optional):
```
PORT=3000
NODE_ENV=development
```

## License

MIT License - Feel free to use and modify!

## Credits

Built with:
- [Express.js](https://expressjs.com/)
- [Socket.IO](https://socket.io/)
- [Google Fonts](https://fonts.google.com/) (Orbitron, Inter)
