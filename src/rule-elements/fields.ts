// No `initial`: the system deletes keys that equal it, so clearing the field wouldn't stick.
export function optionalHoursField(): unknown {
    return new foundry.data.fields.NumberField({ required: false, nullable: true, positive: true });
}
