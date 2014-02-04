(function(){
var translatorSpec = {
	"translatorID": "d921155f-0186-1684-615c-ca57682ced9b",
	"label": "JSTOR",
	"creator": "Simon Kornblith, Sean Takats, Michael Berkowitz, and Eli Osherovich",
	"target": "https?://[^/]*jstor\\.org[^/]*/(action/(showArticle|doBasicSearch|doAdvancedSearch|doLocatorSearch|doAdvancedResults|doBasicResults)|discover|stable/|pss/|betasearch\\?|openurl\\?)",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsib",
	"lastUpdated": "2013-07-09 11:52 AM CET"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	// See if this is a seach results page or Issue content
	if (doc.title == "JSTOR: Search Results" || url.match(/\/i\d+/) || url.indexOf("/betasearch?") !=-1 ||
		(url.match(/stable|pss/) // Issues with DOIs can't be identified by URL
		 && doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue)
	   ) {
		return "multiple";
	} else if(url.indexOf("/search/") != -1) {
		return false;
	}

	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	if(elmt || url.match(/pss/)) {
	return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	var singleDoi = PME.Util.xpathText(doc, "//div[@id='doi']");
	var singleLink = PME.Util.xpathText(doc, "//a[@id='viewCitation']/@href");
	var dois = [];
	if(singleLink) {
		dois.push(decodeURIComponent(singleLink.replace(/.*doi=/, '')));
	}
	else if (singleDoi) {
		dois.push(singleDoi);
	}
	else if (/(?:pss|stable)\/(10\.\d+\/[^?]+)(?:\?.*)?|(?:pss|stable)\/(\d+)/.test(url)
		 && !doc.evaluate('//form[@id="toc"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue) {
		dois.push(RegExp.$1);
	}
	else {
		dois = PME.Util.map(PME.Util.xpath(doc, '//li[@class="row result-item"]//input[@name="doi"]/@value'),PME.Util.getNodeText);
	}
	PME.Util.each(dois, function (doi) {

		var downloadString = "redirectUri=%2Faction%2FexportSingleCitation%3FsingleCitation%3Dtrue%26doi%3D" + doi + "&noDoi=yesDoi&doi=" + doi;
		PME.Util.HTTP.doPost("/action/downloadSingleCitation?userAction=export&format=refman&direct=true&singleCitation=true", downloadString, function (text) {
			var translator = PME.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function (obj, item) {
				var m;
				for (var i = 0, n = item.creators.length; i < n; i++) {
					if (!item.creators[i].firstName && (m = item.creators[i].lastName.match(/^(.+?)\s+(\S+)$/))) {
						item.creators[i].firstName = m[1];
						item.creators[i].lastName = m[2];
						delete item.creators[i].fieldMode;
					}
				}
				if (item.notes && item.notes[0]) {
					// For some reason JSTOR exports abstract with 'AB' tag istead of 'N1'
					item.abstractNote = item.notes[0].note;
					item.abstractNote = item.abstractNote.replace(/^<p>(ABSTRACT )?/, '').replace(/<\/p>$/, '');
					delete item.notes;
				}
				item.attachments = [];

				item.doi = doi;

				if (/stable\/(\d+)/.test(item.url)) {
					var pdfurl = window.location.protocol + "//" + window.location.host + "/stable/pdfplus/" + doi + ".pdf?acceptTC=true";
					item.attachments.push({url: pdfurl, title: "JSTOR Full Text PDF", mimeType: "application/pdf"});
				}
				var matches;
				if (item.ISSN && (matches = item.ISSN.match(/([0-9]{4})([0-9]{3}[0-9Xx])/))) {
					item.ISSN = matches[1] + '-' + matches[2];
				}
				if (!item.title && item.url) {
					PME.Util.processDocuments(item.url, function (doc) {
						if (PME.Util.xpathText(doc, '//div[@class="bd"]/div[@class="rw"]')) {
							item.title = "Review of: " + PME.Util.xpathText(doc, '//div[@class="bd"]/div[@class="rw"]')
						}
						else item.title = PME.Util.xpathText(doc, '//div[@class="bd"]/h2');
					})
				}
				item.complete();
			});
			translator.translate();
		});
	});
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.jstor.org/action/doBasicSearch?Query=chicken&Search.x=0&Search.y=0&wc=on",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.jstor.org/stable/1593514?&Search=yes&searchText=chicken&list=hide&searchUri=%2Faction%2FdoBasicSearch%3FQuery%3Dchicken%26Search.x%3D0%26Search.y%3D0%26wc%3Don&prevSearch=&item=1&ttl=70453&returnArticleService=showFullText",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Dimier-Poisson",
						"firstName": "I. H.",
						"creatorType": "author"
					},
					{
						"lastName": "Bout",
						"firstName": "D. T.",
						"creatorType": "author"
					},
					{
						"lastName": "Quéré",
						"firstName": "P.",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "JSTOR Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"journalAbbreviation": "Avian Diseases",
				"title": "Chicken Primary Enterocytes: Inhibition of Eimeria tenella Replication after Activation with Crude Interferon-γ Supernatants",
				"volume": "48",
				"issue": "3",
				"publisher": "American Association of Avian Pathologists",
				"ISSN": "0005-2086",
				"url": "http://www.jstor.org/stable/1593514",
				"DOI": "10.2307/1593514",
				"date": "September 1, 2004",
				"pages": "617-624",
				"abstractNote": "A reproducible and original method for the preparation of chicken intestine epithelial cells from 18-day-old embryos for long-term culture was obtained by using a mechanical isolation procedure, as opposed to previous isolation methods using relatively high concentrations of trypsin, collagenase, or EDTA. Chicken intestine epithelial cells typically expressed keratin and chicken E-cadherin, in contrast to chicken embryo fibroblasts, and they increased cell surface MHC II after activation with crude IFN-γ containing supernatants, obtained from chicken spleen cells stimulated with concanavalin A or transformed by reticuloendotheliosis virus. Eimeria tenella was shown to be able to develop until the schizont stage after 46 hr of culture in these chicken intestinal epithelial cells, but it was not able to develop further. However, activation with IFN-γ containing supernatants resulted in strong inhibition of parasite replication, as shown by incorporation of [3 H]uracil. Thus, chicken enterocytes, which are the specific target of Eimeria development in vivo, could be considered as potential local effector cells involved in the protective response against this parasite. /// Se desarrolló un método reproducible y original para la preparación de células epiteliales de intestino de embriones de pollo de 18 días de edad para ser empleadas como cultivo primario de larga duración. Las células epiteliales de intestino fueron obtenidas mediante un procedimiento de aislamiento mecánico, opuesto a métodos de aislamientos previos empleando altas concentraciones de tripsina, colagenasa o EDTA. Las células epiteliales de intestino expresaron típicamente keratina y caderina E, a diferencia de los fibroblastos de embrión de pollo, e incrementaron el complejo mayor de histocompatibilidad tipo II en la superficie de la célula posterior a la activación con sobrenadantes de interferón gamma. Los sobrenadantes de interferón gamma fueron obtenidos a partir de células de bazos de pollos estimuladas con concanavalina A o transformadas con el virus de reticuloendoteliosis. Se observó el desarrollo de la Eimeria tenella hasta la etapa de esquizonte después de 46 horas de cultivo en las células intestinales epiteliales de pollo pero no se observó un desarrollo posterior. Sin embargo, la activación de los enterocitos con los sobrenadantes con interferón gamma resultó en una inhibición fuerte de la replicación del parásito, comprobada mediante la incorporación de uracilo [3 H]. Por lo tanto, los enterocitos de pollo, blanco específico del desarrollo in vivo de la Eimeria, podrían ser considerados como células efectoras locales, involucradas en la respuesta protectora contra este parásito.",
				"rights": "Copyright © 2004 American Association of Avian Pathologists",
				"extra": "ArticleType: research-article / Full publication date: Sep., 2004 / Copyright © 2004 American Association of Avian Pathologists",
				"publicationTitle": "Avian Diseases",
				"libraryCatalog": "JSTOR",
				"accessDate": "CURRENT_TIMESTAMP",
				"shortTitle": "Chicken Primary Enterocytes"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.jstor.org/stable/10.1086/245591?&Search=yes&searchText=bread&searchText=engel&searchText=alpern&searchText=barbara&searchText=alone&list=hide&searchUri=%2Faction%2FdoAdvancedSearch%3Fq0%3Dnot%2Bby%2Bbread%2Balone%26f0%3Dall%26c1%3DAND%26q1%3Dbarbara%2Balpern%2Bengel%26f1%3Dall%26acc%3Don%26wc%3Don%26Search%3DSearch%26sd%3D%26ed%3D%26la%3D%26jo%3D&prevSearch=&item=2&ttl=82&returnArticleService=showFullText",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Engel",
						"creatorType": "author",
						"firstName": "Barbara Alpern"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "JSTOR Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"journalAbbreviation": "The Journal of Modern History",
				"title": "Not by Bread Alone: Subsistence Riots in Russia during World War I",
				"volume": "69",
				"issue": "4",
				"publisher": "The University of Chicago Press",
				"ISSN": "0022-2801",
				"url": "http://www.jstor.org/stable/10.1086/245591",
				"DOI": "10.1086/245591",
				"date": "December 1, 1997",
				"pages": "696-721",
				"rights": "Copyright © 1997 The University of Chicago Press",
				"extra": "ArticleType: research-article / Full publication date: December 1997 / Copyright © 1997 The University of Chicago Press",
				"publicationTitle": "The Journal of Modern History",
				"libraryCatalog": "JSTOR",
				"accessDate": "CURRENT_TIMESTAMP",
				"shortTitle": "Not by Bread Alone"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.jstor.org/stable/4122159",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Satz",
						"creatorType": "author",
						"firstName": "Debra"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "JSTOR Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"journalAbbreviation": "Signs",
				"title": "Remaking Families: A Review Essay",
				"volume": "32",
				"issue": "2",
				"publisher": "The University of Chicago Press",
				"ISSN": "0097-9740",
				"url": "http://www.jstor.org/stable/10.1086/508232",
				"DOI": "10.1086/508232",
				"date": "January 1, 2007",
				"pages": "523-538",
				"rights": "Copyright © 2007 The University of Chicago Press",
				"extra": "ArticleType: research-article / Full publication date: Winter 2007 / Copyright © 2007 The University of Chicago Press",
				"publicationTitle": "Signs",
				"libraryCatalog": "JSTOR",
				"accessDate": "CURRENT_TIMESTAMP",
				"shortTitle": "Remaking Families"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.jstor.org/stable/131548",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Burbank",
						"firstName": "Jane",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "JSTOR Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"journalAbbreviation": "Russian Review",
				"volume": "57",
				"issue": "2",
				"publisher": "Wiley on behalf of The Editors and Board of Trustees of the Russian Review",
				"ISSN": "0036-0341",
				"url": "http://www.jstor.org/stable/131548",
				"DOI": "10.2307/131548",
				"date": "April 1, 1998",
				"pages": "310-311",
				"rights": "Copyright © 1998 The Editors and Board of Trustees of the Russian Review",
				"extra": "ArticleType: book-review / Full publication date: Apr., 1998 / Copyright © 1998 The Editors and Board of Trustees of the Russian Review",
				"publicationTitle": "Russian Review",
				"title": "Review of: Soviet Criminal Justice under Stalin by Peter H. Solomon",
				"libraryCatalog": "JSTOR",
				"accessDate": "CURRENT_TIMESTAMP",
				"shortTitle": "Review of"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.jstor.org/action/doAdvancedSearch?q0=solomon+criminal+justice&f0=all&c1=AND&q1=&f1=all&acc=on&wc=on&fc=off&re=on&sd=&ed=&la=&pt=&isbn=&dc.History=History&dc.SlavicStudies=Slavic+Studies&Search=Search",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.jstor.org/betasearch?Query=labor+market&ac=0&si=0",
		"items": "multiple"
	}
]
/** END TEST CASES **/
PME.TranslatorClass.loaded(translatorSpec, { detectWeb: detectWeb, doWeb: doWeb, testCases: testCases });
}());