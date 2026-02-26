type ItemShape = {
  item_type: string
  title?: string | null
  type?: string | null
  attributes?: Record<string, unknown> | null
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getFinancialSubtype(item: ItemShape) {
  const explicitSubtype = asText(item.type)
  if (explicitSubtype === 'Commitment' || explicitSubtype === 'Income') {
    return explicitSubtype
  }

  const attributeSubtype = asText(item.attributes?.financialSubtype)
  if (attributeSubtype === 'Commitment' || attributeSubtype === 'Income') {
    return attributeSubtype
  }

  if (item.item_type === 'FinancialCommitment') {
    return 'Commitment'
  }

  if (item.item_type === 'FinancialIncome') {
    return 'Income'
  }

  return null
}

export function getItemTypeLabel(item: ItemShape) {
  if (item.item_type === 'FinancialItem' || item.item_type === 'FinancialCommitment' || item.item_type === 'FinancialIncome') {
    return 'Financial item'
  }

  return item.item_type
}

export function getItemDisplayName(item: ItemShape) {
  const attributes = item.attributes ?? {}
  const title = asText(item.title)
  if (title) {
    return title
  }

  const explicitName = asText(attributes.name)
  if (explicitName) {
    return explicitName
  }

  if (item.item_type === 'Vehicle') {
    const year = attributes.year
    const make = asText(attributes.make)
    const model = asText(attributes.model)
    const parts = [year, make, model].filter((part) => part !== null && part !== undefined && String(part).trim().length > 0)

    if (parts.length > 0) {
      return parts.join(' ')
    }
  }

  const address = asText(attributes.address)
  if (address) {
    return address
  }

  const vin = asText(attributes.vin)
  if (vin) {
    return vin
  }

  return item.item_type
}
