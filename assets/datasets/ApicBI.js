module.exports = {
    name: 'ApicBI',
    tables: [
        {
            name: 'vi_DimCustomers', columns: [
                { name: 'CustomerNr', dataType: 'Int64' },
                { name: 'CustomerName', dataType: 'String' },
                { name: 'CompanyRegistrationNr', dataType: 'String' },
                { name: 'AcquiringTerminal', dataType: 'String' },
                { name: 'Partner', dataType: 'String' },
                { name: 'BusinessArea', dataType: 'String' },
                { name: 'CustomerSinceDate', dataType: 'DateTime' },
                { name: 'LicenseCount', dataType: 'Int64' },
                { name: 'TransactionValueL12M', dataType: 'Double' }
            ]
        },
        {
            name: 'vi_DimTicketCategories', columns: [
                { name: 'CategoryJoin', dataType: 'String' },
                { name: 'CategoryL1', dataType: 'String' },
                { name: 'CategoryL2', dataType: 'String' },
                { name: 'CategoryL3', dataType: 'String' }
            ]
        },
        {
            name: 'vi_FactTickets', columns: [
                { name: 'CategoryJoin', dataType: 'String' },
                { name: 'ticketId', dataType: 'Int64' },
                { name: 'CustomerContactPerson', dataType: 'String' },
                { name: 'isReseller', dataType: 'Boolean' },
                { name: 'summary', dataType: 'String' },
                { name: 'TransferredToDepartmentName', dataType: 'String' },
                { name: 'status', dataType: 'String' },
                { name: 'CountryShort', dataType: 'String' },
                { name: 'CustomerNumber', dataType: 'String' },
                { name: 'CustomerName', dataType: 'String' },
                { name: 'Company Registration Nr', dataType: 'String' },
                { name: 'CreatedDate', dataType: 'DateTime' },
                { name: 'ClosedDate', dataType: 'DateTime' },
                { name: 'DateUpdated', dataType: 'DateTime' },
                { name: 'DepartmentName', dataType: 'String' },
                { name: 'ProductName', dataType: 'String' },
                { name: 'PhoneNumer', dataType: 'String' }
            ]
        }
    ]
}