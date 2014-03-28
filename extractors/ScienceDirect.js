(function(){
var translatorSpec = 
{
	"translatorID": "b6d0a7a-d076-48ae-b2f0-b6de28b194e",
	"label": "ScienceDirect",
	"creator": "Michael Berkowitz and Aurimas Vinckevicius",
	"target": "^https?://[^/]*science-?direct\\.com[^/]*/science(\\/article)?(\\?(?:.+\\&|)ob=(?:ArticleURL|ArticleListURL|PublicationURL))?",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsib",
	"lastUpdated": "2013-01-29 15:30:07"
}

function detectWeb(doc, url) { }

function scrapeByDirectExport(doc, url) {
	PME.debug("ScienceDirect: Scrapping by RIS directly through export form");
	var postParams = 'citation-type=RIS&zone=exportDropDown&export=Export&format=cite-abs';
	PME.Util.doPost(url, postParams, function (text) { processRIS(doc, text) });
}

function getAbstract(doc) {
	var p = PME.Util.xpath(doc, '//div[contains(@class, "abstract") and not(contains(@class, "abstractHighlights"))]/p');
	var paragraphs = [];
	for (var i = 0; i < p.length; i++)
		paragraphs.push(PME.Util.trimInternal(p[i].textContent));

	return paragraphs.join('\n');
}

function processRIS(doc, text) {
	//T2 doesn't appear to hold the short title anymore.
	//Sometimes has series title, so I'm mapping this to T3, although we currently don't recognize that in RIS
	text = text.replace(/^T2\s/mg, 'T3 ');

	//Sometimes PY has some nonsensical value. Y2 contains the correct date in that case.
	if (text.search(/^Y2\s+-\s+\d{4}\b/m) !== -1) {
		text = text.replace(/TY\s+-[\S\s]+?ER/g, function (m) {
			if (m.search(/^PY\s+-\s+\d{4}\b/m) === -1	&& m.search(/^Y2\s+-\s+\d{4}\b/m) !== -1)
				return m.replace(/^PY\s+-.*\r?\n/mg, '').replace(/^Y2\s+-/mg, 'PY  -');

			return m;
		});
	}

	//Certain authors sometimes have "role" prefixes
	text = text.replace(/^((?:A[U\d]|ED)\s+-\s+)Editor-in-Chief:\s+/mg, '$1');

	var translator = PME.loadTranslator("import");
	translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
	translator.setString(text);
	translator.setHandler("itemDone", function (obj, item) {
		//issue sometimes is set to 0 for single issue volumes (?)
		if (item.issue == 0) delete item.issue;

		//add spaces after initials
		for (var i = 0, n = item.creators.length; i < n; i++) {
			if (item.creators[i].firstName)
				item.creators[i].firstName = item.creators[i].firstName.replace(/\.\s*(?=\S)/g, '. ');
		}

		//abstract is not included with the new export form. Scrape from page
		if (!item.abstractNote)
			item.abstractNote = getAbstract(doc);

		var pdfLink = getPDFLink(doc);
		if (pdfLink) item.attachments.push({
			title: 'ScienceDirect Full Text PDF',
			url: pdfLink,
			mimeType: 'application/pdf'
		});

		if (item.notes[0]) {
			item.abstractNote = item.notes[0].note;
			item.notes = new Array();
		}
		if (item.abstractNote)
			item.abstractNote = item.abstractNote.replace(/^\s*(?:abstract|publisher\s+summary)\s+/i, '');

		item.DOI = item.DOI.replace(/^doi:\s+/i, '');
		item.complete();
	});
	translator.translate();
}

function getPDFLink(doc) {
	return PME.Util.xpathText(doc, '//div[@id="articleNav"]//div[@class="icon_pdf"]/a[not(@title="Purchase PDF")]/@href[1]');
}

function getISBN(doc) {
	var isbn = PME.Util.xpathText(doc, '//td[@class="tablePubHead-Info"]//span[@class="txtSmall"]');
	if(!isbn) return;

	isbn = isbn.match(/ISBN:\s*([-\d]+)/);
	if(!isbn) return;

	return isbn[1].replace(/[-\s]/g, '');
}

function scrapeByISBN(doc) {
	var isbn = getISBN(doc);
	var translator = PME.loadTranslator("search");
	translator.setTranslator("c73a4a8c-3ef1-4ec8-8229-7531ee384cc4");
	translator.setSearch({ ISBN: isbn });
	translator.translate();
}

function getArticleList(doc) {
	return PME.Util.xpath(doc,
		'(//table[@class="resultRow"]/tbody/tr/td[2]/a\
		|//table[@class="resultRow"]/tbody/tr/td[2]/h3/a\
		|//td[@class="nonSerialResultsList"]/h3/a)[not(contains(text(),"PDF (") or contains(text(), "Related Articles"))]');
}

function doWeb(doc, url) {
	var itemList = getArticleList(doc);

	if(itemList && itemList.length > 0) {
		//search page
		var items = {};
		for(var i=0, n=itemList.length; i<n; i++)
			items[itemList[i].href] = PME.Util.getNodeText(itemList[i]);

		PME.selectItems(items, function(selectedItems) {
			if(!selectedItems) return true;

			var articles = [];
			for (var i in selectedItems)
				PME.Util.processDocuments(i, scrape);	//move this out of the loop when PME.Util.processDocuments is fixed
		});
	}
	else {
		scrape(doc);
	}
}

function scrape(doc) {
	var form = PME.Util.xpath(doc, '//div[@id="export_popup"]/form')[0];

	if (form)
		scrapeByDirectExport(doc, form.action);
	else if (getISBN(doc))
		scrapeByISBN(doc);
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science/article/pii/S0896627311004430#bib5",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Schaaf",
						"firstName": "Christian P.",
						"creatorType": "author"
					},
					{
						"lastName": "Zoghbi",
						"firstName": "Huda Y.",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "ScienceDirect Snapshot"
					},
					{
						"title": "ScienceDirect Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Solving the Autism Puzzle a Few Pieces at a Time",
				"journalAbbreviation": "Neuron",
				"volume": "70",
				"issue": "5",
				"pages": "806-808",
				"ISSN": "0896-6273",
				"DOI": "10.1016/j.neuron.2011.05.025",
				"url": "http://www.sciencedirect.com/science/article/pii/S0896627311004430",
				"abstractNote": "In this issue, a pair of studies (Levy et al. and Sanders et al.) identify several de novo copy-number variants that together account for 5%–8% of cases of simplex autism spectrum disorders. These studies suggest that several hundreds of loci are likely to contribute to the complex genetic heterogeneity of this group of disorders. An accompanying study in this issue (Gilman et al.), presents network analysis implicating these CNVs in neural processes related to synapse development, axon targeting, and neuron motility.",
				"date": "June 9, 2011",
				"publicationTitle": "Neuron",
				"libraryCatalog": "ScienceDirect",
				"accessDate": "CURRENT_TIMESTAMP"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science/article/pii/S016748890800116X",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Pereira",
						"firstName": "C.",
						"creatorType": "author"
					},
					{
						"lastName": "Silva",
						"firstName": "R.D.",
						"creatorType": "author"
					},
					{
						"lastName": "Saraiva",
						"firstName": "L.",
						"creatorType": "author"
					},
					{
						"lastName": "Johansson",
						"firstName": "B.",
						"creatorType": "author"
					},
					{
						"lastName": "Sousa",
						"firstName": "M.J.",
						"creatorType": "author"
					},
					{
						"lastName": "Côrte-Real",
						"firstName": "M.",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Yeast apoptosis",
					"Apoptotic regulators",
					"Mitochondrial outer membrane permeabilization",
					"Permeability transition pore",
					"Bcl-2 family",
					"Mitochondrial fragmentation"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "ScienceDirect Snapshot"
					},
					{
						"title": "ScienceDirect Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Mitochondria-dependent apoptosis in yeast",
				"journalAbbreviation": "Biochimica et Biophysica Acta (BBA) - Molecular Cell Research",
				"volume": "1783",
				"issue": "7",
				"pages": "1286-1302",
				"shortTitle": "Apoptosis in yeast",
				"ISSN": "0167-4889",
				"DOI": "10.1016/j.bbamcr.2008.03.010",
				"url": "http://www.sciencedirect.com/science/article/pii/S016748890800116X",
				"abstractNote": "Mitochondrial involvement in yeast apoptosis is probably the most unifying feature in the field. Reports proposing a role for mitochondria in yeast apoptosis present evidence ranging from the simple observation of ROS accumulation in the cell to the identification of mitochondrial proteins mediating cell death. Although yeast is unarguably a simple model it reveals an elaborate regulation of the death process involving distinct proteins and most likely different pathways, depending on the insult, growth conditions and cell metabolism. This complexity may be due to the interplay between the death pathways and the major signalling routes in the cell, contributing to a whole integrated response. The elucidation of these pathways in yeast has been a valuable help in understanding the intricate mechanisms of cell death in higher eukaryotes, and of severe human diseases associated with mitochondria-dependent apoptosis. In addition, the absence of obvious orthologues of mammalian apoptotic regulators, namely of the Bcl-2 family, favours the use of yeast to assess the function of such proteins. In conclusion, yeast with its distinctive ability to survive without respiration-competent mitochondria is a powerful model to study the involvement of mitochondria and mitochondria interacting proteins in cell death.",
				"date": "July 2008",
				"publicationTitle": "Biochimica et Biophysica Acta (BBA) - Molecular Cell Research",
				"libraryCatalog": "ScienceDirect",
				"accessDate": "CURRENT_TIMESTAMP"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science/book/9780123694683",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science/article/pii/B9780123694683500083",
		"items": [
			{
				"itemType": "bookSection",
				"creators": [
					{
						"lastName": "Raabe",
						"firstName": "Dierk",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "ScienceDirect Snapshot"
					},
					{
						"title": "ScienceDirect Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "8 - Introduction to discrete dislocation statics and dynamics",
				"bookTitle": "Computational Materials Engineering",
				"publisher": "Academic Press",
				"place": "Burlington",
				"pages": "267-316",
				"ISBN": "978-0-12-369468-3",
				"DOI": "10.1016/B978-012369468-3/50008-3",
				"url": "http://www.sciencedirect.com/science/article/pii/B9780123694683500083",
				"abstractNote": "Publisher Summary \r\nThis chapter provides an introduction to discrete dislocation statics and dynamics. The chapter deals with the simulation of plasticity of metals at the microscopic and mesoscopic scale using space- and time-discretized dislocation statics and dynamics. The complexity of discrete dislocation models is due to the fact that the mechanical interaction of ensembles of such defects is of an elastic nature and, therefore, involves long-range interactions. Space-discretized dislocation simulations idealize dislocations outside the dislocation cores as linear defects that are embedded within an otherwise homogeneous, isotropic or anisotropic, linear elastic medium. The aim of the chapter is to concentrate on those simulations that are discrete in both space and time. It explicitly incorporates the properties of individual lattice defects in a continuum formulation. The theoretical framework of linear continuum elasticity theory is overviewed as required for the formulation of basic dislocation mechanics. The chapter also discusses the dislocation statics, where the fundamentals of linear isotropic and anisotropic elasticity theory that are required in dislocation theory are reviewed. The chapter describes the dislocation dynamics, where it is concerned with the introduction of continuum dislocation dynamics. The last two sections deal with kinematics of discrete dislocation dynamics and dislocation reactions and annihilation.",
				"date": "2007",
				"libraryCatalog": "ScienceDirect",
				"accessDate": "CURRENT_TIMESTAMP"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science?_ob=RefWorkIndexURL&_idxType=AU&_cid=277739&_acct=C000228598&_version=1&_userid=10&md5=a27159035e8b2b8e216c551de9cedefd",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"lastName": "Likens",
						"firstName": "Gene E",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [],
				"libraryCatalog": "Open WorldCat",
				"language": "English",
				"url": "http://public.eblib.com/EBLPublic/PublicView.do?ptiID=634856",
				"title": "Encyclopedia of inland waters",
				"publisher": "Elsevier",
				"place": "Amsterdam; Boston",
				"date": "2009",
				"ISBN": "9780123706263  0123706262",
				"abstractNote": "Contains over 240 individual articles covering various broad topics including properties of water hydrologic cycles, surface and groundwater hydrology, hydrologic balance, lakes of the world, rivers of the world, light and heat in aquatic ecosystems, hydrodynamics and mixing in rivers, reservoirs, and lakes, biological integration among inland aquatic ecosystems, pollution and remediation, and conservation and management of inland aquatic ecosystems.",
				"accessDate": "CURRENT_TIMESTAMP"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science?_ob=RefWorkIndexURL&_idxType=AR&_cid=277739&_acct=C000228598&_version=1&_userid=10&md5=54bf1ed459ae10ac5ad1a2dc11c873b9",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.sciencedirect.com/science/article/pii/B9780123706263000508",
		"items": [
			{
				"itemType": "bookSection",
				"creators": [
					{
						"lastName": "Meybeck",
						"firstName": "M.",
						"creatorType": "author"
					},
					{
						"lastName": "Gene E. Likens",
						"creatorType": "editor"
					}
				],
				"notes": [],
				"tags": [
					"Africa",
					"Damming",
					"Endorheism",
					"Human impacts",
					"River quality",
					"River regimes",
					"Sediment fluxes",
					"Tropical rivers"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "ScienceDirect Snapshot"
					},
					{
						"title": "ScienceDirect Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Africa",
				"bookTitle": "Encyclopedia of Inland Waters",
				"publisher": "Academic Press",
				"place": "Oxford",
				"pages": "295-305",
				"ISBN": "978-0-12-370626-3",
				"DOI": "10.1016/B978-012370626-3.00050-8",
				"url": "http://www.sciencedirect.com/science/article/pii/B9780123706263000508",
				"abstractNote": "The African continent (30.1 million km2) extends from 37°17′N to 34°52 S and covers a great variety of climates except the polar climate. Although Africa is often associated to extended arid areas as the Sahara (7 million km2) and Kalahari (0.9 million km2), it is also characterized by a humid belt in its equatorial part and by few very wet regions as in Cameroon and in Sierra Leone. Some of the largest river basins are found in this continent such as the Congo, also termed Zaire, Nile, Zambezi, Orange, and Niger basins. Common features of Africa river basins are (i) warm temperatures, (ii) general smooth relief due to the absence of recent mountain ranges, except in North Africa and in the Rift Valley, (iii) predominance of old shields and metamorphic rocks with very developed soil cover, and (iv) moderate human impacts on river systems except for the recent spread of river damming. African rivers are characterized by very similar hydrochemical and physical features (ionic contents, suspended particulate matter, or SPM) but differ greatly by their hydrological regimes, which are more developed in this article.",
				"date": "2009",
				"libraryCatalog": "ScienceDirect",
				"accessDate": "CURRENT_TIMESTAMP"
			}
		]
	}
]
/** END TEST CASES **/
PME.TranslatorClass.loaded(translatorSpec, { detectWeb: detectWeb, doWeb: doWeb, testCases: testCases });
}());