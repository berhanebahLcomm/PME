var fs = require('graceful-fs');
var path = require('path');
var stack = require('./stack');
var archiver = require('archiver');
var c = require('./common'),
	_zoteroFilesLocation,
	_pmeLocation,
	_buildLocation,
	_builderConfigFilesLocation,
	_archiveInfo = []
_translatorsIndex = [];

function addZipInfo(from, st) {
	st.push();
	fs.readdir(from, function (err, objects) {
		objects.forEach(function (obj) {
			var fromPath = path.join(from, obj);
			st.push();
			fs.stat(fromPath, function (err, stats) {
				if (stats.isDirectory()) {
					addZipInfo(fromPath, st)
				}
				else {
					_archiveInfo.push(fromPath)
				}
				st.pop();
			});
		});
		st.pop();
	});
}
function addTranslatorToZip(st, root) {
	st.push();
	var translators = path.join(_zoteroFilesLocation, "translators"),
		translatorsCount,
		reID = /"translatorID":\s*"(.+)"/,
		reLabel = /"label":\s*"(.+)"/,
		reDate = /"lastUpdated":\s*"(.+)"/,
		output = fs.createWriteStream(path.join(root, "translators.zip")),
		archive = archiver('zip');

	archive.on('error', function (err) {
		throw err;
	});
	output.on('finish', function () {
		st.pop();
	});
	archive.pipe(output);
	var indexStack = new stack(function () {
		_translatorsIndex.forEach(function (o) {
			archive.append(fs.createReadStream(o.objPath), {name: o.name});
		});
		archive.finalize();
	})
	indexStack.push();
	fs.readdir(translators, function (err, objects) {
		translatorsCount = 0;
		var total = objects.length;
		objects.forEach(function (obj) {
			var objPath = path.join(translators, obj);
			if (path.extname(objPath) == ".js") {
				if (++translatorsCount == total) {
					objPath = path.join(_pmeLocation, "Empty.js");
				}
				indexStack.push();
				var indFile = path.join(root, "translators.index");
				addTranslatorToIndex(objPath, translatorsCount, indexStack, indFile, translatorsCount == total)
			}
			else {
				total--;
			}
		});
		indexStack.pop();
	});
}
function addTranslatorToIndex(objPath, count, st, file, last) {
	var reID = /"translatorID":\s*"(.+)"/,
		reLabel = /"label":\s*"(.+)"/,
		reDate = /"lastUpdated":\s*"(.+)"/;
	fs.readFile(objPath, function (err, data) {
		var id, label, date;
		var text = data.toString();
		reID.exec(text);
		id = RegExp.$1;
		reLabel.exec(text);
		label = RegExp.$1;
		reDate.exec(text);
		date = RegExp.$1;
		var newLine = [count + ".js", id, label, date].join(",") + "\n";
		fs.appendFile(file, newLine, function () {
		});
		_translatorsIndex.push({objPath: objPath, name: count + ".js"});
		if (last) {
			fs.appendFile(file,
					++count + ".js,9751de72-3d4b-4187-bfda-deb34b936620,pme_ui,n/a\n",
				function () {
				});
			_translatorsIndex.push({objPath: path.join(_pmeLocation, 'pme_ui.js'), name: count + ".js"});
		}
		st.pop();
	});

}

function setConfig(common) {
	_zoteroFilesLocation = common.config.zoteroFilesLocation;
	_pmeLocation = common.config.pmeFilesLocation;
	_buildLocation = common.config.buildLocation;
	_builderConfigFilesLocation = common.config.builderConfigFilesLocation;
}

module.exports = function (debug) {
	this.buildFirefox = function () {
		console.log("Starting Firefox");
		var common = new c(debug, new stack(function () {
			common.stackInst = new stack(function () {
				if (!common.debug) {
					console.log('creating .xpi file')
					var output = fs.createWriteStream(extFile);
					var archive = archiver('zip');
					archive.on('error', function (err) {
						throw err;
					});
					output.on('finish', function () {
						common.deleteDirectory(root, function () {
						})
						console.log('Firefox complete');
					});
					archive.pipe(output);
					addZipInfo(root, new stack(function () {
						_archiveInfo.forEach(function (fPath) {
							archive.append(fs.createReadStream(fPath), {name: fPath.replace(root, '')});
						});
						archive.finalize();
					}))
				}
				else
					console.log("Firefox complete. No extension file")
			});
			common.copyCode(_pmeLocation, path.join(root, "chrome/content/zotero/xpcom"), ["progressWindow.js"]);
			common.copyCode(_pmeLocation, path.join(root, "chrome/content/zotero"), ["overlay.xul"]);
			common.copyCode(path.join(_zoteroFilesLocation, "translators"), root, ["deleted.txt"]);
			common.copyCode(_pmeLocation, root, ["install.rdf", "update.rdf"]);
			common.copyCode(_builderConfigFilesLocation, root, ['chrome.manifest'])
			common.copyCode(_builderConfigFilesLocation, path.join(root, 'chrome/skin/default/zotero'), ['zotero-new-z-48px.png', 'zotero-new-z-16px.png', 'zotero-z-16px-australis.svg'])

			common.modifyZoteroConfig(path.join(root, "chrome/content/zotero/xpcom/zotero.js"));

			common.appendCode([
				path.join(_pmeLocation, 'translate.js')
			], path.join(root, 'chrome/content/zotero/xpcom/translation/translate.js'), null, false);
			common.appendCode([
				path.join(_pmeLocation, 'utilities_translate.js')
			], path.join(root, 'chrome/content/zotero/xpcom/utilities_translate.js'), null, false);
			common.appendCode([
				path.join(_pmeLocation, 'browser.js')
			], path.join(root, 'chrome/content/zotero/browser.js'), null, false);
		}));

		setConfig(common);
		var root = path.join(_buildLocation, "firefox");
		var extFile = path.join(_buildLocation, "firefoxConnector.xpi");
		fs.unlink(extFile, function () {
		});

		common.doPrepWork(root, function () {
			common.stackInst.push();
			fs.mkdir(root, function () {
				common.copyCode(_zoteroFilesLocation, root, undefined, ["!", "translators"], [
					{
						fileName: 'all',
						pattern: /(?:((?:(?:chrome)|(?:resource)):\/\/)zotero((?:-platform)?\/))|(?:(\.append\(')zotero('\)))/g,
						replacement: function () {
							return (RegExp.$1 || RegExp.$3) + 'pme' + (RegExp.$2 || RegExp.$4);
						}
					},
					{
						fileName: 'all',
						pattern: /Zotero_Browser/g,
						replacement: "PME_Browser"
					},
					{
						fileName: 'all',
						pattern: /@zotero\.org\/Zotero/g,
						replacement: "@proquest.com/PME"
					},
					{
						fileName: 'all',
						pattern: /e4c61080-ec2d-11da-8ad9-0800200c9a66/g,
						replacement: "b1571583-82c5-499a-b578-b2e719ddc094"
					},
					{
						fileName: 'all',
						pattern: /zotero-toolbar-button/g,
						replacement: "pme-toolbar-button"
					}
				]);
				addTranslatorToZip(common.stackInst, root);
				common.stackInst.pop();
			});
		});
	}
}

