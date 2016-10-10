/**
 * Created by Volodymyr on 10.10.2016.
 */

const shipAutoPlace = fleet => {
    let ships = fleet.shipElements;
    var box = gui.ownField.getBoundingClientRect();

    //We need the border for lessen if's. So array dimension is 12x12, not 10x10.
    let board = new Array(12).fill(0).map(x => new Array(12).fill(0));

    // Generator which returns all the cells arounds ship and on it
    function* coordinates(ship, xx, yy) {
        let width = ship.dx[ship.dx.length-1];
        let height = ship.dy[ship.dy.length-1];
        for (let x=xx; x<=xx+width+2; x++) {
           for (let y=yy; y<=yy+height+2; y++){
                yield [x, y];
            }
        }
    }

    let checkPlace = (ship, xx, yy) => {
        for (let i=0; i<ship.dx.length; i++) {
            let x = xx + ship.dx[i];
            let y = yy + ship.dy[i];
            if (board[x+1][y+1]) { return false; }
        }
        return true;
    };

    let placeShip = (ship, xx, yy) => {
        for (let [x, y] of coordinates(ship, xx, yy)) {
            board[x][y]++;
        }
        ship.x0 = xx;
        ship.y0 = yy;
        let x = (xx + 1) * CELL_SIZE + 3;
        let y = (yy + 1) * CELL_SIZE + 3;
        ship.style.position = 'absolute';
        ship.style.left = x + pageXOffset + box.left + 'px';
        ship.style.top  = y + pageYOffset + box.top + 'px';
    };

    for (let ship of ships) {
        let startX, startY, x0, y0;
        if (ship.disposed) {
            ownFleet.touchSea(ship, -1);
        } else {
            document.body.appendChild(ship);
            ship.disposed = true;
        }
        if (Math.random()<0.5) {
            [ship.style.width, ship.style.height] = [ship.style.height, ship.style.width];
            [ship.dx, ship.dy] = [ship.dy, ship.dx];
        }
        let shipWidth = ship.dx[ship.dx.length-1];
        let shipHeight = ship.dy[ship.dy.length-1];
        do {
            x0 = Math.floor(Math.random() * (10-shipWidth));
            y0 = Math.floor(Math.random() * (10-shipHeight));
        } while (!checkPlace(ship, x0, y0));
        placeShip(ship, x0, y0);
        ownFleet.touchSea(ship);
    }
    playSound .placed();
};



