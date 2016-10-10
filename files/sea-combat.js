/* Client part of the Sea Combat network game
 * Created by Volodymyr Lomako on 01.10.2016.
*/

//These constant and variables are used not only here but also in the 'dragndrop' module.
//So they are in the global scope
const CELL_SIZE = 28;
const DX = [-1, 0, 1,-1, 1,-1, 0, 1, 0];
const DY = [-1,-1,-1, 0, 0, 1, 1, 1, 0];

class Snd {
    constructor() {
        this.mute = false;
        this.STRIKE = new Audio("/sound/explosion.mp3");
        this.MISSED = new Audio("/sound/tuk.mp3");
        this.PLACED = new Audio("/sound/placed.mp3");
        this.CANTPLACE = new Audio("/sound/placement_error.mp3");
        this.SANK = new Audio("/sound/sinking.mp3");
    }
    strike() {
        if (!this.mute) {
            this.STRIKE.currentTime = 0;
            this.STRIKE.play();
        }
    }
    missed() { if (!this.mute) { this.MISSED.play(); } }
    placed() { if (!this.mute) { this.PLACED.play(); } }
    cantplace() { if (!this.mute) { this.CANTPLACE.play(); } }
    sank() { if (!this.mute) { this.SANK.play(); } }
}

var playSound = new Snd;

let gui;
let ownFleet, rivalFleet;

const seaBattleApplication = () => {
    const IMG_BLANK = '/graph/cell-blank.png';
    const IMG_DOT   = '/graph/cell-dot.png';
    const IMG_CROSS = '/graph/cell-cross.png';
    const [EMPTY, SHIP, DOT, CROSS] = [0,1,2,3];
    const [NOTREADY, WAITING, IDLE, CANMOVE] = [0,1,2,3];

    var gameState;
    var socket = io();

    // An empty matrix 10x10 builder
    const getMatrix = () => new Array(10).fill(0).map(x => new Array(10).fill(0));
    
    // constructor of the object, which contain all the data of one side of the war conflict )
    class GamerData {

        //Draw the ship rectangle when all of its desks are fired
        _drawTheShip(xx, yy) {
            var ship = this.ships[this.shipNumber[xx][yy]];
            var left = ship.x[0];
            var top = ship.y[0];
            var right = ship.x[ship.x.length-1] + 1;
            var bottom = ship.y[ship.y.length-1] + 1;
            var box = this.table.getBoundingClientRect();
            var div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.height = CELL_SIZE * (bottom-top) - 3 + 'px';
            div.style.width =  CELL_SIZE * (right-left) - 3  + 'px';
            div.style.left = (left+1)*CELL_SIZE + pageXOffset + box.left + 3 + 'px';
            div.style.top  = (top+1)*CELL_SIZE + pageYOffset + box.top + 3 + 'px';
            div.classList.add('ship');
            document.body.appendChild(div);
        }

        //All the cells of the ship were targeted
        _isKilled(xx, yy) {
            var ship = this.ships[this.shipNumber[xx][yy]];
            var {x, y} = ship;
            for (var i=0; i<x.length; i++) {
                if (this.cellState[x[i]][y[i]] != CROSS ) { return false; }
            }
            return true;
        }

        _putDotsAroundShip (xx, yy) {
            var ship = this.ships[this.shipNumber[xx][yy]];
            var {x, y} = ship;
            for (var i = 0; i < x.length; i++) {
                for (var j=0; j<8; j++) {
                    var xxx = x[i]+DX[j];
                    var yyy = y[i]+DY[j];
                    if (0>xxx || xxx>9 || 0>yyy || yyy>9) { continue; }
                    if (this.cellState[xxx][yyy]==EMPTY){
                        this.cellState[xxx][yyy] = DOT;
                        this.cellElements[xxx][yyy].style.background = `url(${IMG_DOT})`;
                    }
                }
            }
        }
        // fill the this.ships with ships' coordinates
        fillShipsTable() {
            for (var shipEl of this.shipElements) {
                var ship = {x:[], y:[]};
                for (var i=0; i<shipEl.dx.length; i++){
                    ship.x.push(shipEl.x0 + shipEl.dx[i]);
                    ship.y.push(shipEl.y0 + shipEl.dy[i]);
                }
                this.ships.push(ship);
            }
            this.fillCellStates();
        }

        fillCellStates() {
            for (var n=0; n<this.ships.length; n++) {
                var {x, y} = this.ships[n];
                for (var i=0; i<x.length; i++) {
                    this.cellState[x[i]][y[i]] = SHIP;
                    this.shipNumber[x[i]][y[i]] = n;
                }
            }
        }

        fire(x, y) {
            if (this.cellState[x][y] == EMPTY) {
                this.cellState[x][y] = DOT;
                this.cellElements[x][y].style.background = `url(${IMG_DOT})`;
                setGameState(this.isEnemy ? IDLE : CANMOVE);
                playSound.missed();
                return;
            }
            // cell state here can be "SHIP" only
            setGameState(this.isEnemy ? CANMOVE : IDLE);
            this.desksLeft--;
            this.cellState[x][y] = CROSS;
            this.cellElements[x][y].style.background = `url(${IMG_CROSS})`;
            playSound.strike();
            if (this._isKilled(x, y)){
                this.shipsLeft--;
                this._putDotsAroundShip(x, y);
                playSound.sank();
                if (this.isEnemy) {this._drawTheShip(x, y);}
            }
            this.infoElement.innerHTML = this.shipsLeft+'/'+this.desksLeft;
            if (!this.desksLeft) { gameOver(this.isEnemy); }
        }

        constructor (tableElement) {
            var self = this;
            this.isEnemy = (tableElement === gui.rivalField);
            this.shipsLeft = 10;
            this.desksLeft = 20;
            this.ships = [];
            this.table = tableElement;
            this.sea = getMatrix(); // used when drag & drop
            this.shipElements = []; // list of the own ships in the form of HTML DIVs
            this.cellElements = getMatrix();
            this.cellState = getMatrix();
            this.shipNumber = getMatrix();
        }

    }

    // In the rial application the message will be more complex than "alert"
    const showMessage = (text) => {
        alert(text);
    };

    const startApp = () => {
        //DOM elements, sript works with
        gui = {
            mute: document.querySelector('#mute input'),
            ownField: document.getElementById('own-field'),
            rivalField: document.getElementById('rival-field'),
            ownInfo: document.querySelector('#own-data span'),
            rivalInfo: document.querySelector('#rival-data span'),
            shipyard: document.getElementById('shipyard'),
            inputName: document.querySelector('.container input'),
            ownName: document.querySelector('#own-data h2'),
            rivalName: document.querySelector('#rival-data h2'),
            colShipyard: document.getElementsByClassName('container')[1],
            colRival: document.getElementsByClassName('container')[2],
            colWait: document.getElementsByClassName('container')[3]         
        };
        const createShips = () => {
            var shipyard = gui.shipyard;
            for (var size=4; size>0; size--) {
                for (var n=5-size; n>0; n--) {
                    var ship = document.createElement('div');
                    ship.style.height = CELL_SIZE - 3 + 'px';
                    ship.style.width = CELL_SIZE*size - 3  + 'px';
                    ship.classList.add('ship');
                    ship.dx = [0,1,2,3].slice(0, size);
                    ship.dy = [0,0,0,0].slice(0, size);
                    ship.disposed = false;
                    ship.classList.add('draggable');
                    shipyard.appendChild(ship);
                    ownFleet.shipElements.push(ship);
                }
            }
        };

        const createTable = fleet => {
            for (var i=0; i<10; i++) {
                var tr = document.createElement('tr');
                var th = document.createElement('th');
                th.appendChild(document.createTextNode((i+1).toString()));
                tr.appendChild(th);
                fleet.table.appendChild(tr);
                for (var j=0; j<10; j++) {
                    var td = document.createElement('td');
                    td.style.background = `url(${IMG_BLANK})`;
                    // td.style.backgroundSize = CELL_SIZE - 1 + 'px';
                    td.style.backgroundRepeat = "no-repeat";
                    tr.appendChild(td);
                    td.x = j;
                    td.y = i;
                    fleet.cellElements[j][i] = td;
                }
            }
        };

        const mute = () => {
            playSound.mute = gui.mute.checked;
        };

        gameState = NOTREADY;
        ownFleet = new GamerData(gui.ownField);
        rivalFleet = new GamerData(gui.rivalField);
        ownFleet.infoElement = gui.ownInfo;
        rivalFleet.infoElement = gui.rivalInfo;
        createTable(ownFleet);
        createTable(rivalFleet);
        createShips();
        document.onmousedown = shipShuffle;
        gui.mute.onclick = mute;
        mute();
        gui.colShipyard.hidden = false;
        gui.colRival.hidden = true;
        gui.colWait.hidden = true;
    };

    // clear the data after the game finished
    const clearOldData = () => {
        var ships = Array.from(document.getElementsByClassName('ship'));
        for (let ship of ships) {
            document.body.removeChild(ship);
        }
        var trs = Array.from(document.getElementsByTagName('tr'));
        for (let tr of trs) {
            if (!tr.classList.contains('table-header')){
                tr.parentNode.removeChild(tr);
            }
        }
        gui.rivalInfo.innerHTML = '10/20';
        gui.ownInfo.innerHTML = '10/20';
    };

    // begin firing on the one another ships
    const startGame = () => {

        const fire = ev => {
            if (gameState != CANMOVE) { return; }
            var rivalBoard = rivalFleet.table;
            var target = ev.target;
            while ( target.tagName != 'TD' ) {
                if (target == rivalBoard) { return; }
                target = target.parentNode;
            }
            var cellState = rivalFleet.cellState[target.x][target.y];
            if (cellState==DOT || cellState==CROSS) {
                showMessage('Firing on the used targets is a bad idea.');
                return;
            }
            socket.emit('move', [target.x, target.y]);
            rivalFleet.fire(target.x,target.y);
        };
        gui.colWait.hidden = true;
        gui.colRival.hidden = false;
        gui.rivalName.innerHTML = rivalFleet.gamerName;
        rivalFleet.fillCellStates();
        gui.rivalField.onclick = fire;
    };

    // finish ships placement and send data to the server
    const registerOnServer = () => {
        var gamerName = gui.inputName.value;
        if (!gamerName) {
            showMessage('Enter your name, please.');
            return;
        }
        for (var ship of ownFleet.shipElements) {
            if (!ship.disposed) {
                showMessage('Not all the ships are moved to the game board');
                return;
            }
        }
        gui.ownName.innerHTML = gamerName;
        ownFleet.gamerName = gamerName;
        document.onmousedown = null;
        gui.colShipyard.hidden = true;
        gui.colWait.hidden = false;
        ownFleet.fillShipsTable();
        socket.emit('register', {firstmove: true, ships: ownFleet.ships, username: gamerName});
        gameState = WAITING;
    };

    const gameOver = (isWin) => {
        gui.ownField.classList.remove('faded-out');
        gui.rivalField.classList.remove('faded-out');
        if (isWin) {
            showMessage(`Congratulations, ${ownFleet.gamerName}. You won!`);
        } else {
            showMessage(`Shame on you, loser! ${rivalFleet.gamerName} defeated you.`)
        }
        socket.emit('game over');
        clearOldData();
        startApp();
    };

    // visualise the move turn
    const setGameState = (state) => {
        if (gameState == state) { return; }
        gameState = state;
        if (state == CANMOVE) {
            gui.ownField.classList.add('faded-out');
            gui.rivalField.classList.remove('faded-out');
        } else {
            gui.ownField.classList.remove('faded-out');
            gui.rivalField.classList.add('faded-out');

        }
    };

    socket.on('register', (userdata) => {
        if (gameState!=WAITING) { return; } //Some error happend
        setGameState( userdata.firstmove ? CANMOVE : IDLE );
        rivalFleet.ships = userdata.ships;
        rivalFleet.gamerName = userdata.username;
        startGame();
    });

    socket.on('register', userdata => {
        if (gameState!=WAITING) { return; } //Some error happend
        setGameState( userdata.firstmove ? CANMOVE : IDLE );
        rivalFleet.ships = userdata.ships;
        rivalFleet.gamerName = userdata.username;
        startGame();
    });

    socket.on('move', coordinates => {
       [x, y] = coordinates;
        ownFleet.fire(x, y);
    });

    socket.on('link lost', () => {
        if (gameState!=IDLE && gameState!=CANMOVE) { return; } //It is some error.
        gui.ownField.classList.remove('faded-out');
        gui.rivalField.classList.remove('faded-out');
        showMessage(`Your rival ${rivalFleet.gamerName} fleed (disconnected). You win.`);
        clearOldData();
        startApp();
    });

    document.getElementsByTagName('button')[0].onclick = registerOnServer;

    startApp();
};

document.addEventListener("DOMContentLoaded", seaBattleApplication);