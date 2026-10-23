/** Punto de entrada de la web app. */
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Dashboard de la feria')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Incluye un archivo HTML o CSS/JS del dashboard dentro de la plantilla. */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
