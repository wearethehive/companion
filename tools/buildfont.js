var fs = require('fs');
var PNG = require('pngjs').PNG;
var font = {};

fs.readdir("./font", function(err, items) {
		console.log(items);

		for (var i=0; i<items.length; i++) {
			if (items[i].match(/\.png$/)) {
				var file = "./font/" + items[i];
				var num = items[i].split(/\./);
				var asc = num[0];
				console.log("file", file);
				var data = fs.readFileSync(file);
				var png = PNG.sync.read(data);
				var dots = [];

				for (var y = 0; y < png.height; y++) {
					for (var x = 0; x < png.width; x++) {
						var idx = (png.width * y + x) << 2;
						if (png.data[idx+3] != 0) {
							dots.push([x,y]);
						}
					}
				}
				font['' + asc] = dots;
			}
		}

		console.log(JSON.stringify(font));
});
