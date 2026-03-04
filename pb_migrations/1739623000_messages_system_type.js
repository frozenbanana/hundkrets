// Add message_type for system messages; make sender optional for system messages.

migrate((app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");
  if (!messagesCol.fields.getByName("message_type")) {
    messagesCol.fields.add(
      new SelectField({
        name: "message_type",
        required: false,
        maxSelect: 1,
        values: ["user", "system"],
      })
    );
  }
  const senderField = messagesCol.fields.getByName("sender");
  if (senderField) senderField.required = false;
  app.save(messagesCol);
}, (app) => {
  const messagesCol = app.findCollectionByNameOrId("messages");
  messagesCol.fields.removeByName("message_type");
  const senderField = messagesCol.fields.getByName("sender");
  if (senderField) senderField.required = true;
  app.save(messagesCol);
});
