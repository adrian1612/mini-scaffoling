# Mini Scaffolding

Portable HTML/CSS/JS version of the scaffolding workflow.

## How it works

1. Open `index.html`.
2. Paste a table scheme into the schema textarea.
3. Adjust `Table Name` and `Preferred Class Name`.
4. Click `Generate Output`.
5. Use `Edit` on an output card if you want to adjust an existing template in a popup.
6. Open `designer.html` when you want to create a new template in a dedicated page.
7. Load a template folder with `Load Template Folder` if you want to use your own files.
8. Use search, source/category filters, and collapse/expand controls to keep larger template sets manageable.

## Layout

- `index.html` is the focused generator workspace.
- `designer.html` is the dedicated template authoring page.
- Saved templates are stored in browser `localStorage` and appear automatically on the generator page.
- The designer page now includes a saved-template library with load, duplicate, and delete actions.

## Template format

Each template file can optionally start with metadata:

```txt
#! name: Model
#! file: {{ model.UseName }}.cs
```

Then write the template body using the portable mini-template syntax:

- `{{ model.UseName }}`
- `{{ for item in model.Param }} ... {{ end }}`
- `{{ if model.PrimaryRouteConstraint != "" }} ... {{ else }} ... {{ end }}`

Core legend:

- `model.UseName`, `model.Table`, `model.TableName`, `model.TableSchema`, `model.TableQualifiedName`
- `model.Primary`, `model.PrimaryDataType`, `model.PrimaryRouteConstraint`, `model.ClassLower`
- `model.Param` for all columns, `model.ParamNoPrimary` for all columns except the selected primary column
- `item.ColumnName`, `item.ReadableName`, `item.KeywordDataType`, `item.SqlDataType`, `item.Nullable`, `item.CanBeNullable`, `item.IsAutoIncrement`

Common helpers:

- `value | string.lower`, `string.upper`, `string.trim`, `string.replace`
- `value | array.join ", "`, `array.size`, `array.first`, `array.last`
- `value | number.round`, `number.floor`, `number.ceil`, `number.format "0.00"`
- `date.now | date.to_string "yyyy-MM-dd"`, `date.today`, `date.add_days 1`
- `default value, "fallback"` and `empty value`

## Important

This browser version does not run the full Scriban engine from the desktop app.
It supports the common basics used by the starter templates plus several common helpers such as `string.upper`, `string.lower`, `string.trim`, `string.replace`, `array.join`, `array.size`, `default`, and `empty`.
Template expressions are now restricted to the supported templating surface, so imported templates should still be treated as trusted authoring input rather than arbitrary executable script.

Starter examples are included in `template-examples`.
