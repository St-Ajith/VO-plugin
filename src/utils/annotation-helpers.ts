// ============================================================================
// ANNOTATION HELPERS - Annotation-specific utility functions
// ============================================================================

/**
 * Extract element metadata and generate intelligent defaults for annotations
 */
export function extractElementMetadata(element: SceneNode): {
  elementType: string;
  textContent: string;
  voicedPreview: string;
  suggestedRole: string;
  suggestedTrait: string;
  suggestedHintIOS: string;
  suggestedHintAndroid: string;
} {
  let elementTypeName = ""; // Human-readable element type name
  let textContent = "";
  let suggestedRole = "";
  let suggestedTrait = "";
  let suggestedHintIOS = ""; // iOS-specific hint
  let suggestedHintAndroid = ""; // Android-specific hint

  // Extract text content from the element
  if (element.type === "TEXT") {
    textContent = (element).characters;
    elementTypeName = "Text";
    suggestedRole = "text";
    suggestedTrait = "Static Text";
    suggestedHintIOS = "";
    suggestedHintAndroid = "";
  } else if (
    element.type === "FRAME" ||
    element.type === "COMPONENT" ||
    element.type === "INSTANCE"
  ) {
    // Check if frame/component contains text
    const textNodes = element.findAll((n) => n.type === "TEXT") as TextNode[];
    if (textNodes.length > 0) {
      textContent = textNodes.map((t) => t.characters).join(" ");
    }

    // Infer element type from name
    const nameLower = element.name.toLowerCase();
    if (nameLower.includes("button") || nameLower.includes("btn")) {
      elementTypeName = "Button";
      suggestedRole = "button";
      suggestedTrait = "Button";
      // iOS uses "open", Android uses "activate"
      suggestedHintIOS = textContent
        ? `Dobbelttrykk for å åpne ${textContent}`
        : "Dobbelttrykk for å åpne";
      suggestedHintAndroid = textContent
        ? `Dobbelttrykk for å aktivere ${textContent}`
        : "Dobbelttrykk for å aktivere";
    } else if (
      nameLower.includes("input") ||
      nameLower.includes("field") ||
      nameLower.includes("textbox")
    ) {
      elementTypeName = "Input Field";
      suggestedRole = "textbox";
      suggestedTrait = "Text Field";
      suggestedHintIOS = textContent
        ? `Skriv inn ${textContent}`
        : "Skriv inn tekst";
      suggestedHintAndroid = textContent
        ? `Skriv inn ${textContent}`
        : "Skriv inn tekst";
    } else if (nameLower.includes("checkbox") || nameLower.includes("check")) {
      elementTypeName = "Checkbox";
      suggestedRole = "checkbox";
      suggestedTrait = "Button";
      suggestedHintIOS = "Dobbelttrykk for å velge eller fjerne valg";
      suggestedHintAndroid = "Dobbelttrykk for å velge eller fjerne valg";
    } else if (nameLower.includes("radio")) {
      elementTypeName = "Radio Button";
      suggestedRole = "radio";
      suggestedTrait = "Button";
      suggestedHintIOS = "Dobbelttrykk for å velge dette alternativet";
      suggestedHintAndroid = "Dobbelttrykk for å velge dette alternativet";
    } else if (nameLower.includes("switch") || nameLower.includes("toggle")) {
      elementTypeName = "Switch";
      suggestedRole = "switch";
      suggestedTrait = "Button";
      suggestedHintIOS = "Dobbelttrykk for å slå av eller på";
      suggestedHintAndroid = "Dobbelttrykk for å slå av eller på";
    } else if (
      nameLower.includes("image") ||
      nameLower.includes("img") ||
      nameLower.includes("icon")
    ) {
      elementTypeName = "Image";
      suggestedRole = "image";
      suggestedTrait = "Image";
      suggestedHintIOS = "";
      suggestedHintAndroid = "";
    } else if (nameLower.includes("link")) {
      elementTypeName = "Link";
      suggestedRole = "link";
      suggestedTrait = "Link";
      suggestedHintIOS = textContent
        ? `Dobbelttrykk for å åpne ${textContent}`
        : "Dobbelttrykk for å åpne lenke";
      suggestedHintAndroid = textContent
        ? `Dobbelttrykk for å åpne ${textContent}`
        : "Dobbelttrykk for å åpne lenke";
    } else if (
      nameLower.includes("header") ||
      nameLower.includes("heading") ||
      nameLower.includes("title")
    ) {
      elementTypeName = "Heading";
      suggestedRole = "heading";
      suggestedTrait = "Header";
      suggestedHintIOS = "";
      suggestedHintAndroid = "";
    } else {
      elementTypeName = "Frame";
      suggestedRole = "group";
      suggestedTrait = "None";
      suggestedHintIOS = "";
      suggestedHintAndroid = "";
    }
  } else if (
    element.type === "RECTANGLE" ||
    element.type === "ELLIPSE" ||
    element.type === "POLYGON" ||
    element.type === "STAR" ||
    element.type === "VECTOR"
  ) {
    elementTypeName = "Shape";
    suggestedRole = "img";
    suggestedTrait = "Image";
    suggestedHintIOS = "";
    suggestedHintAndroid = "";
  } else if (element.type === "GROUP") {
    const textNodes = element.findAll((n) => n.type === "TEXT") as TextNode[];
    if (textNodes.length > 0) {
      textContent = textNodes.map((t) => t.characters).join(" ");
    }
    elementTypeName = "Group";
    suggestedRole = "group";
    suggestedTrait = "None";
    suggestedHintIOS = "";
    suggestedHintAndroid = "";
  } else {
    // Fallback for any other node types
    elementTypeName = element.type;
    suggestedRole = "group";
    suggestedTrait = "None";
    suggestedHintIOS = "";
    suggestedHintAndroid = "";
  }

  // Generate voiced preview based on extracted data
  let voicedPreview = "";
  if (textContent) {
    voicedPreview = `"${textContent}. ${elementTypeName}."`;
  } else {
    voicedPreview = `"${element.name}. ${elementTypeName}."`;
  }

  return {
    elementType: elementTypeName,
    textContent,
    voicedPreview,
    suggestedRole,
    suggestedTrait,
    suggestedHintIOS,
    suggestedHintAndroid,
  };
}

