'use strict';

class KDL2Factory {

    /* Takes a list of files. */
    constructor(fileList) {
        this.fileList = fileList;
    }

    open() {
        if (this.fileList.length <= 0) {
            throw 'fileList must have at least 1 file';
        }

        let _this = this;

        for (let index = 0; index < this.fileList.length; index += 1) {
            let file         = this.fileList[index];
            let reader       = new FileReader();
            reader.onloadend = function () {
                _this.levels = _this.parseROM(this.result);
                //_this.toCanvas();
            };
            reader.onerror   = this.errorHandler;
            reader.onabort   = this.errorHandler;

            reader.readAsArrayBuffer(file);
        }
    }

    errorHandler(error) {
        console.log(error);
        throw 'An unrecoverable error has occurred';
    }

    calculateAddress(address, bank) {
        return (0x4000 * bank) + (address & 0x3FFF);
    }

    byteSwap(lsb, msb) {
        return (((0 | msb) << 8) | lsb);
    }

    /* I simulate what the game does, along with Game Boy's CPU effects */
    generateProceduralData() {
        var list     = [];
        var a        = 0x07;
        var carryBit = 0;
        var index    = 0;

        while (a != 0) {
            for (var b = 0; b < 8; b += 1) {

                // rrc l
                carryBit = index & 0x01;
                index    = (carryBit << 7) | (index >> 1);

                // rla
                a        = (a << 1) | carryBit;
                carryBit = (a >> 8) & 0x01;
                a        = a & 0xFF;
            }

            list.push(a);
            index += 1;
            a += 1;
            if (a > 0xFF) {
                a = 0;
            }
        }

        return list;
    }

    decompress(data, address) {
        let index            = address;
        let endOfFileByte    = 0xFF;
        let decompressedData = [];
        let proceduralData   = this.generateProceduralData();

        /* Temporary variables */
        let byte1      = 0;
        let byte2      = 0;
        let startIndex = 0;

        let currentByte = data.getUint8(index);
        index += 1;
        while (currentByte != endOfFileByte) {
            let typeNibble   = currentByte & 0xE0;
            let numberNibble = currentByte & 0x1F;

            /* The number doesn't fit into a nibble, so the next
               byte is the number. */
            let expansionByte = currentByte & 0xE0;
            if (expansionByte === 0xE0) {
                typeNibble   = (currentByte << 3) & 0xE0;
                numberNibble = data.getUint8(index);
                index += 1;
            }

            switch(typeNibble) {

            case 0x20:
                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(data.getUint8(index));
                }
                index += 1;
                break;

            case 0x40:
                byte1 = data.getUint8(index + 0);
                byte2 = data.getUint8(index + 1);

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(byte1);
                    decompressedData.push(byte2);
                }
                index += 2;
                break;

            case 0x60:
                byte1 = data.getUint8(index);

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(byte1);
                    byte1 += 1;
                }
                index += 1;
                break;

            case 0x80:
                startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    let copyByte = decompressedData[startIndex];
                    decompressedData.push(copyByte);
                    startIndex += 1;
                }
                index += 2;

                break;

            case 0xA0:
                startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    /* The data at decompressData[i] acts as an index for the proceduralData. */
                    let proceduralIndex = decompressedData[startIndex];
                    let theByte = proceduralData[proceduralIndex];
                    decompressedData.push(theByte);
                    startIndex += 1;
                }

                index += 2;
                break;

            case 0xC0:
                startIndex = this.byteSwap(data.getUint8(index + 1), data.getUint8(index + 0));

                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    let copyByte = decompressedData[startIndex];
                    decompressedData.push(copyByte);
                    startIndex -= 1;
                }
                index += 2;
                break;

            default:
                for (let count = 0; count < (numberNibble + 1); count += 1) {
                    decompressedData.push(data.getUint8(index));
                    index += 1;
                }
                break;
            }

            currentByte = data.getUint8(index);
            index += 1;
        }

        return decompressedData;
    }

    parseROM(arrayBuffer) {
        let data              = new DataView(arrayBuffer);
        let levelTableBank    = 8;
        let levelTableAddress = 0x511F;
        let index             = this.calculateAddress(levelTableAddress, levelTableBank);
        let totalLevels       = 177;
        let levels            = [];

        index += 1;
        for (let counter = 0; counter < totalLevels; counter += 1) {
            let lsb  = data.getUint8(index);
            index += 1;
            let msb  = data.getUint8(index);
            index += 1;
            let bank = data.getUint8(index);
            index += 1;

            let address = this.byteSwap(lsb, msb);

            let level = {
                address,
                bank
            };

            levels.push(level);

            this.parseLevel(data, level);
        }

        return levels;
    }

    parseLevel(data, level) {
        let index = this.calculateAddress(level.address, level.bank);

        level.verticalSlices = data.getUint8(index);
        index += 1;
        level.horizontalSlices = data.getUint8(index);
        index += 1;

        level.geometry = {
            left :  data.getUint8(index + 0),
            top  :  data.getUint8(index + 1),
            right:  data.getUint8(index + 2),
            bottom: data.getUint8(index + 3)
        };

        index += 4;

        level.assets = {
            address: this.byteSwap(data.getUint8(index + 0), data.getUint8(index + 1)),
            bank   : data.getUint8(index + 2)
        };

        index += 3;

        this.parseAssets(data, level.assets);

        //Skip level objects
        index += 3

        //Skip level door table
        index += 3;

        //Skip unknown byte
        index += 1;

        level.blocks = {
            data: this.decompress(data, index)
        };

    }

    parseAssets(data, assets) {
        let index = this.calculateAddress(assets.address, assets.bank);

        assets.tiles = {
            address: this.byteSwap(data.getUint8(index + 0), data.getUint8(index + 1)),
            bank   : data.getUint8(index + 2)
        };
        index += 3;


        let address = this.calculateAddress(assets.tiles.address, assets.tiles.bank);

        /* This byte determines where to start writing in our "VRAM" */
        let vramStart = (0x9630 - (data.getUint8(address) << 4)) & 0xFFFF;

        // If vramStart is less than 0x8800, then we're using 8000 mode
        if (vramStart < 0x8800) {
            assets.tiles.vram = 0x8000;
        } else {
            assets.tiles.vram = 0x8800;
        }
        address += 1;

        assets.tiles.data = this.decompress(data, address);

        /* We modify the data so it simulates what KDL2 assumes on a Game Boy's VRAM. */

        // First we pad the start of the data, but taking our VRAM start address and subtracting with the total size of VRAM */

        let prePadding = vramStart - assets.tiles.vram;
        let amountToFill = new Array(prePadding).fill(0);
        assets.tiles.data = amountToFill.concat(assets.tiles.data);
        let postPadding = (assets.tiles.vram + 0x1800) - assets.tiles.data.length;
        assets.tiles.data = assets.tiles.data.concat(new Array(postPadding).fill(0));

        /* There are 3 tiles that act as "fill" at the end of it. */
        assets.tiles.data.splice((0x7d+0x80)*16, 16, ...[0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00]);
        assets.tiles.data.splice((0x7e+0x80)*16, 16, ...[0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF,0x00,0xFF]);
        assets.tiles.data.splice((0x7f+0x80)*16, 16, ...[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);


        assets.tiles.chunkSize = data.getUint8(index);
        index += 1;
        assets.tiles.translation = this.decompress(data, index);
        assets.tiles.layer = [];

        let previousCounters = 0;
        for (let current = 0; current < 4; current += 1) {
            assets.tiles.layer[current] = [];

            let counter = 0;
            for (; counter < assets.tiles.chunkSize; counter += 1) {
                assets.tiles.layer[current].push(assets.tiles.translation[counter + previousCounters]);
            }
            previousCounters += counter;
        }
    }

    /* Takes a canvas context and level index */
    assemble(context, index) {
        if (this.levels === undefined) {
            throw 'No levels are loaded.';
        }

        if (this.levels.length <= 0) {
            throw 'No levels are loaded.';
        }

        if (index >= this.levels.length) {
            throw 'Level does not exist';
        }

        let level = this.levels[index];

        /* Clear the canvas */
        context.clearRect(0, 0, canvas.width, canvas.height);


        function getTiles(data, layer, number) {
            let tileNumber = level.assets.tiles.layer[layer][number];
            let index = 0;

            if (tileNumber > 0x7F) {
                tileNumber = tileNumber % 0x80;
            } else {
                tileNumber += 0x80;
            }

            tileNumber *= 16;
            return data.slice(tileNumber, tileNumber+16);
        }

        let data = level.assets.tiles.data;

        let x = 0;
        let oldX = x;
        let y = 0;
        let oldY = y;
        let verticalSlice = 0;
        let horizontalSlice = 0;

        let tiles = level.blocks.data.map((aByte) => {
            tilePut(context, getTiles(data, 0, aByte), x, y);
            x += 1;
            tilePut(context, getTiles(data, 1, aByte), x, y);
            x -= 1;
            y += 1;
            tilePut(context, getTiles(data, 2, aByte), x, y);
            x += 1;
            tilePut(context, getTiles(data, 3, aByte), x, y);

            /* Put ourselves at the next position */
            y -= 1;
            x += 1;

            /* The length of one chunk is 16, 2x2 tiles. */
            if (x % (16*2) === 0) {
                y += 2;
                x = oldX;
            }

            if (x % (16*2) === 0 && y % (16*2) === 0) {
                y = oldY;
                x += 16*2;
                oldX = x;
                verticalSlice += 1;
            }

            if (verticalSlice >= level.verticalSlices) {
                y += 16*2;
                oldY = y;

                x = 0;
                oldX = x;

                verticalSlice = 0;
                horizontalSlice += 1;
            }
        });

    }

}

/* Simulates what it'd look like in VRAM */
function vramPut(context, tiles) {
    for (var y = 0; y < 16; y += 1) {
        for (var x = 0; x < 16; x += 1) {
            var index = (x*16)+(y*16*0x100);
            tilePut(context, tiles.slice(index, index+16), x, y);
        }
    }
}

/* Tile x and tile y, not pixel positions! */
function tilePut(context, tiles, x, y) {
    function image() { return context.createImageData(1,1); }
    function put(pixel, x, y) {
        let color = colors[pixel];
        context.putImageData(color, x, y);
    }

    var colors = [image(), image(), image(), image()];
    var lumin = 256;

    colors.forEach((color) => {
        var d = color.data;
        d[0]   = lumin;
        d[1]   = lumin;
        d[2]   = lumin;
        d[3]   = 255;

        lumin -= (0x100 / 4);
    });

    x *= 8;
    y *= 8;

    let oldX = x;
    let oldY = y;

    for (let index = 0; index < tiles.length; index += 2) {
        let byte1 = tiles[index + 0];
        let byte2 = tiles[index + 1];

        x = oldX;

        for (let bit = 7; bit >= 0; bit -= 1) {
            let bit1 = (byte1 >> bit) & 0x1;
            let bit2 = (byte2 >> bit) & 0x1;

            let pixel = (((0 | bit1) << 1) | bit2);
            put(pixel, x, y);
            x += 1;
        }

        y += 1;

        if (y % 8 === 0) {
            oldY = y;
            y += 8;
        }
    }
}

function execute() {
    let levelFilesInput = document.getElementById('kirbyLevelFile').files;
    window.kdl2Factory = new KDL2Factory(levelFilesInput);
    kdl2Factory.open();

}

