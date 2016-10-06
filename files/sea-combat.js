/* Client part of the Sea Combat network game
 * Created by Volodymyr Lomako on 01.10.2016.
*/
IMG_BLANK = '/graph/cell-blank.png';
IMG_DOT   = '/graph/cell-dot.png';
IMG_CROSS = '/graph/cell-cross.png';
const [EMPTY, SHIP, DOT, CROSS] = [0,1,2,3];
const [NOTREADY, WAITING, IDLE, CANMOVE] = [0,1,2,3];
DX = [-1, 0, 1,-1, 1,-1, 0, 1, 0];
DY = [-1,-1,-1, 0, 0, 1, 1, 1, 0];
CELL_SIZE = 28;

var ownFleet, rivalFleet;
var gameState;
var socket = io();
document.addEventListener("DOMContentLoaded", startApp);

//DOM elements, sript works with
function Gui() {
    this.ownField = document.getElementById('own-field');
    this.rivalField = document.getElementById('rival-field');
    this.ownInfo = document.getElementById('own-data').getElementsByTagName('span')[0];
    this.rivalInfo = document.getElementById('rival-data').getElementsByTagName('span')[0];
    this.shipyard = document.getElementById('shipyard');
    this.inputName = document.getElementsByTagName('input')[0];
    this.ownName = document.getElementById('own-data').getElementsByTagName('h2')[0];
    this.rivalName = document.getElementById('rival-data').getElementsByTagName('h2')[0];
    [this.colOwn, this.colShipyard, this.colRival, this.colWait] =
        document.getElementsByClassName('container');
}

function GamerData(tableElement) {
    var self = this;

    function getMatrix() {
        return [0,1,2,3,4,5,6,7,8,9].map( x => {return [0,0,0,0,0,0,0,0,0,0];} );
    }
    // fill the self.ships with ships' coordinates
    self.fillShipsTable = () => {
        for (var shipEl of self.shipElements) {
            var ship = {x:[], y:[]};
            for (var i=0; i<shipEl.dx.length; i++){
                ship.x.push(shipEl.x0 + shipEl.dx[i]);
                ship.y.push(shipEl.y0 + shipEl.dy[i]);
            }
            self.ships.push(ship);
        }
        self.fillCellStates();
    };

    self.fillCellStates = () => {
        for (var n=0; n<self.ships.length; n++) {
            var {x, y} = self.ships[n];
            for (var i=0; i<x.length; i++) {
                self.cellState[x[i]][y[i]] = SHIP;
                self.shipNumber[x[i]][y[i]] = n;
            }
        }
    };

    //Draw the ship rectangle when all of its desks are fired
    function drawTheShip(xx, yy) {
        var ship = self.ships[self.shipNumber[xx][yy]];
        var left = ship.x[0];
        var top = ship.y[0];
        var right = ship.x[ship.x.length-1] + 1;
        var bottom = ship.y[ship.y.length-1] + 1;
        var box = tableElement.getBoundingClientRect();
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
    function isKilled(xx, yy) {
        var ship = self.ships[self.shipNumber[xx][yy]];
        var {x, y} = ship;
        for (var i=0; i<x.length; i++) {
            if (self.cellState[x[i]][y[i]] != CROSS ) { return false; }
        }
        return true;
    }

    function putDotsAroundShip(xx, yy) {
        var ship = self.ships[self.shipNumber[xx][yy]];
        var {x, y} = ship;
        for (var i = 0; i < x.length; i++) {
            for (var j=0; j<8; j++) {
                var xxx = x[i]+DX[j];
                var yyy = y[i]+DY[j];
                if (0>xxx || xxx>9 || 0>yyy || yyy>9) { continue; }
                if (self.cellState[xxx][yyy]==EMPTY){
                    self.cellState[xxx][yyy] = DOT;
                    self.cellElements[xxx][yyy].style.background = `url(${IMG_DOT})`;
                }
            }
        }
    }

    self.fire = (x, y) => {
        if (self.cellState[x][y] == EMPTY) {
            self.cellState[x][y] = DOT;
            self.cellElements[x][y].style.background = `url(${IMG_DOT})`;
            setGameState(isEnemy ? IDLE : CANMOVE);
            return;
        }
        // cell state here can be "SHIP" only
        setGameState(isEnemy ? CANMOVE : IDLE);
        desksLeft--;
        self.cellState[x][y] = CROSS;
        self.cellElements[x][y].style.background = `url(${IMG_CROSS})`;
        if (isKilled(x, y)){
            shipsLeft--;
            putDotsAroundShip(x, y);
            if (isEnemy) {drawTheShip(x, y);}
        }
        self.infoElement.innerHTML = shipsLeft+'/'+desksLeft;
        if (!desksLeft) { gameOver(isEnemy); }
    };

    var isEnemy = (tableElement === gui.rivalField);
    var shipsLeft = 10;
    var desksLeft = 20;
    self.ships = [];
    self.table = tableElement;
    self.sea = getMatrix(); // used when drag & drop
    self.shipElements = []; // list of the own ships in the form of HTML DIVs
    self.cellElements = getMatrix();
    self.cellState = getMatrix();
    self.shipNumber = getMatrix();
}

function createTable(fleet) {
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
}

function createShips() {
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
}

function showMessage(text, type='inform') {
    alert(text);
}

function startApp() {
    gameState = NOTREADY;
    gui = new Gui();
    ownFleet = new GamerData(gui.ownField);
    rivalFleet = new GamerData(gui.rivalField);
    ownFleet.infoElement = gui.ownInfo;
    rivalFleet.infoElement = gui.rivalInfo;
    createTable(ownFleet);
    createTable(rivalFleet);
    createShips();
    document.onmousedown = shipShuffle;
    gui.colShipyard.hidden = false;
    gui.colRival.hidden = true;
    gui.colWait.hidden = true;

}

function clearOldData() {
    var ships = Array.from(document.getElementsByClassName('ship'));
    for (ship of ships) {
        console.log('removed');
        document.body.removeChild(ship);
    }
    var trs = Array.from(document.getElementsByTagName('tr'));
    for (tr of trs) {
        if (!tr.classList.contains('table-header')){
            tr.parentNode.removeChild(tr);
        }
    }
    gui.rivalInfo.innerHTML = '10/20';
    gui.ownInfo.innerHTML = '10/20';
}

function fire(ev) {
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
}

function startGame() {
    gui.colWait.hidden = true;
    gui.colRival.hidden = false;
    gui.rivalName.innerHTML = rivalFleet.gamerName;
    rivalFleet.fillCellStates();
    gui.rivalField.onclick = fire;
}

function connect2server() {
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
    socket.emit('register', {firstmove:true, ships:ownFleet.ships, username:gamerName});
    gameState = WAITING;
}

function gameOver(isWin) {
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
}

function setGameState(state) {
    if (gameState == state) { return; }
    gameState = state;
    if (state == CANMOVE) {
        gui.ownField.classList.add('faded-out');
        gui.rivalField.classList.remove('faded-out');
    } else {
        gui.ownField.classList.remove('faded-out');
        gui.rivalField.classList.add('faded-out');

    }
}

socket.on('register', (userdata) => {
    if (gameState!=WAITING) { return; } //Some error happend
    setGameState( userdata.firstmove ? CANMOVE : IDLE );
    rivalFleet.ships = userdata.ships;
    rivalFleet.gamerName = userdata.username;
    startGame();
});

socket.on('move', (coordinates) => {
   [x, y] = coordinates;
    ownFleet.fire(x, y);
});

socket.on('link lost', () => {
    if (gameState!=IDLE && gameState!=CANMOVE) { return; } //It is some error.
    gui.ownField.classList.remove('faded-out');
    gui.rivalField.classList.remove('faded-out');
    showMessage(`Your rival ${rivalFleet.gamerName} fleed (disconnected). You win.`)
    clearOldData();
    startApp();
});