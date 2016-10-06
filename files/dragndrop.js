/* This file contains all the mouse event handlers in the
   stage of ships' settings on the field
* */
function shipShuffle(e) {

    var ship = e.target;

    if (!ship.classList.contains('draggable')) return;

    var shiftX, shiftY;
    var starttime; // Timestamp of dragging start
    var shipyard = gui.shipyard;


    startDrag(e.clientX, e.clientY);

    document.onmousemove = function (e) {
        moveAt(e.clientX, e.clientY);
    };

    ship.onmouseup = function () {
        finishDrag();
    };

    function startDrag(clientX, clientY) {
        shiftX = clientX - ship.getBoundingClientRect().left;
        shiftY = clientY - ship.getBoundingClientRect().top;
        ship.style.position = 'fixed';
        document.body.appendChild(ship);
        moveAt(clientX, clientY);
        dockShip();
        starttime = Date.now();
    }

    // check if the ship fits in field and among other ships
    function checkShipPosition(x, y) {
        var maxx = 9 - ship.dx[ship.dx.length-1];
        var maxy = 9 - ship.dy[ship.dy.length-1];
        if (0>x || x>maxx || 0>y || y>maxy) { return false; }
        for (var i=0; i<ship.dx.length; i++) {
            if (ownFleet.sea[x+ship.dx[i]][y+ship.dy[i]] > 0) {
                return false;
            }
        }
        return true;
    }

    function finishDrag() {
        var box = gui.ownField.getBoundingClientRect();
        var x = parseInt(ship.style.left)-box.left - 2;
        var y = parseInt(ship.style.top)-box.top - 2;
        x = Math.round(x/CELL_SIZE - 1);
        y = Math.round(y/CELL_SIZE - 1);
        if (checkShipPosition(x, y)) {
            disposeShip(x, y);
            // tie the element to the document, not to the viewport
            x = (x + 1) * CELL_SIZE + 3;
            y = (y + 1) * CELL_SIZE + 3;
            ship.style.position = 'absolute';
            ship.style.left = x + pageXOffset + box.left + 'px';
            ship.style.top  = y + pageYOffset + box.top + 'px';
        } else {
            // throw the ship back to the shipyard
            shipyard.appendChild(ship);
            ship.style.position = 'static';
            if (Date.now() - starttime < 500) { shipRotate(); }
        }
        document.onmousemove = null;
        ship.onmouseup = null;
    }

    // Move the dragged element to the mouse coordinates
    // If element shift outside the window, the function scroll it.
    function moveAt(clientX, clientY) {
        var newX = clientX - shiftX;
        var newY = clientY - shiftY;
        var scrollY;
        var newBottom = newY + ship.offsetHeight;
        if (newBottom > document.documentElement.clientHeight) {
            var docBottom = document.documentElement.getBoundingClientRect().bottom;
            scrollY = Math.min(docBottom - newBottom, 10);
            if (scrollY < 0) scrollY = 0;
            window.scrollBy(0, scrollY);
            newY = Math.min(newY, document.documentElement.clientHeight - ship.offsetHeight);
        }
        if (newY < 0) {
            scrollY = Math.min(-newY, 10);
            if (scrollY < 0) scrollY = 0;
            window.scrollBy(0, -scrollY);
            newY = Math.max(newY, 0);
        }
        if (newX < 0) newX = 0;
        if (newX > document.documentElement.clientWidth - ship.offsetWidth) {
            newX = document.documentElement.clientWidth - ship.offsetWidth;
        }
        ship.style.left = newX + 'px';
        ship.style.top = newY + 'px';
    }

    function shipRotate(){
        [ship.style.width, ship.style.height] = [ship.style.height, ship.style.width];
        [ship.dx, ship.dy] = [ship.dy, ship.dx];
    }

    // Generator which returns all the cells arounds ship and on it
    function* coordinates(x, y) {
        for (var desk=0; desk<ship.dx.length; desk++) {
            var deskx = x + ship.dx[desk];
            var desky = y + ship.dy[desk];
            for (var i=0; i<9; i++){
                resx = deskx + DX[i];
                resy = desky + DY[i];
                if (0<=resx && resx<10 && 0<=resy && resy<10) {
                    yield [resx, resy];
                }
            }
        }
    }

    function disposeShip(x, y) {
        if (ship.disposed) { return; }
        ship.disposed = true;
        ship.x0 = x;
        ship.y0 = y;
        for(var coord of coordinates(x, y)) {
            var [i,j] = coord;
            ownFleet.sea[i][j] += 1;
        }
    }

    function dockShip() {
        if (!ship.disposed) { return; }
        ship.disposed = false;
        for(var coord of coordinates(ship.x0, ship.y0)) {
            var [i,j] = coord;
            ownFleet.sea[i][j] -= 1;
        }
    }
    return false;
};