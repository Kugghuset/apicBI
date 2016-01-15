
-- Filter variables
DECLARE @Now DateTime = GETDATE()
DECLARE @StartOfToday DateTime = DATEADD(day, DATEDIFF(day, 0, @Now), 0)
DECLARE @StartOfWeek DateTime = DATEADD(ww, DATEDIFF(ww, 1, @Now), 0)

/*
 * Declartion of all active agents today.
 * Used for matching only agents which have worked today.
*/
DECLARE @ActiveAgents TABLE (
    [UserId] VarChar(255) NULL
)
INSERT INTO @ActiveAgents 
SELECT [LocalUserId] AS [UserId]
FROM [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [LocalUserId] != '-'
    AND [CallDirection] = 'Inbound'
    AND [ConnectedDate] != '1970-01-01 01:00:00.000'
    AND [InitiatedDate] > @StartOfToday
GROUP BY [LocalUserId]

/*
 * Declaration of a call table where most columns are stripped out.
 * This is used to significantly reduce the query time by
 * only doing the complex comparisons on a subset of the complete table.
*/
DECLARE @ThisWeeksCalls TABLE (
    [LocalUserId] VarChar(255) NULL
   ,[CallDurationSeconds] Int NULL
   ,[InitiatedDate] DateTime NULL
)
-- Populate @ThisWeeksCalls
INSERT INTO @ThisWeeksCalls
SELECT [LocalUserId]
      ,[CallDurationSeconds]
      ,[InitiatedDate]
FROM [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [CallDirection] = 'Inbound'
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'
  AND [InitiatedDate] > @StartOfWeek
  AND [LocalUserId] IN (SELECT * FROM @ActiveAgents)

/*
 * Selects all agents which have been active today.
 *
 * Output per row:
 * [Agent]                                      Name of the agent
 * [Total calls today]                          The number of received calls for the agent today
 * [Total calls this week]                      The total number of received calls for the agent this week
 * [Average calls by now]                       The average of calls the agent has receied up until the current hour previous days this week
 * [Average call duration today]                The average call length in seconds of the agent today
 * [Pretty average call duration today]         The average call length in seconds of the agent today in a pretty format
 * [Average call duration this week]            The average call length in seconds of the agent this week
 * [Pretty average call duration this week]     The average call length in seconds of the agent this week in a pretty format
 * [Average call duration by now]               The average call length in seconds of the agent up until the current hour previous days of the week
 * [Pretty average call duration by now]        The average call length in seconds of the agent up until the current hour previous days of the week in a pretty format
*/
SELECT [iDetails].[FirstName] + ' ' + [iDetails].[LastName] AS [Agent]
      ,[cView].[Total calls today]
      ,[tView].[Total calls this week]
      ,[avgCView].[Average calls by now]
      ,[cView].[Average call duration today]
      ,RIGHT(CONVERT(CHAR(8),DATEADD(second,[cView].[Average call duration today],0),108),5) AS [Pretty average call duration today]
      ,[tView].[Average call duration this week]
	  ,RIGHT(CONVERT(CHAR(8),DATEADD(second,[tView].[Average call duration this week],0),108),5) AS [Pretty average call duration this week]
      ,[avgCView].[Average call duration by now]
	  ,RIGHT(CONVERT(CHAR(8),DATEADD(second,[avgCView].[Average call duration by now],0),108),5) AS [Pretty average call duration by now]
FROM [SP_I3_IC].[dbo].[IndivDetails] AS [iDetails]

/*
 * Left join for the [Average gal duration this week] and [Total calls today].
*/
LEFT JOIN (
    SELECT [LocalUserId] AS [UserId]
          ,AVG([CallDurationSeconds]) AS [Average call duration this week]
          ,COUNT(*) AS [Total calls this week]
          FROM @ThisWeeksCalls
          GROUP BY [LocalUserId]
) AS [tView]
ON [iDetails].[ICUserID] = [tView].[UserId]

/*
 * Left join for the [Average call duration today] and [Total calls today]
*/
LEFT JOIN (
    SELECT [LocalUserId] AS [UserId]
          ,AVG([CallDurationSeconds]) AS [Average call duration today]
          ,COUNT(*) AS [Total calls today]
    FROM @ThisWeeksCalls
    WHERE [InitiatedDate] > @StartOfToday
    GROUP BY [LocalUserId]
    ) AS [cView]
ON [iDetails].[ICUserID] = [cView].[UserId]

/*
 * Left join for the [Average call duration by now] and [Average calls by now]
 * Values may be NULL, as the agent might not have worked before today.
*/
LEFT JOIN (
    SELECT [LocalUserId] AS [UserId]
          ,AVG([CallDurationSeconds]) AS [Average call duration by now]
          ,CAST(
            ROUND(COUNT(*) * 1.00 / DATEDIFF(dd, @StartOfWeek, @Now), 0)
            AS Int) AS [Average calls by now]
    FROM @ThisWeeksCalls
    WHERE [InitiatedDate] < @StartOfToday
      AND [InitiatedDate] <=
                -- The date of [InitiatedDate] and the time of @Now
                -- are combined into a date string as such '2016-01-14 19:10'
                CONVERT(VARCHAR(10), [InitiatedDate], 120)
                + ' '
                + CONVERT(VARCHAR(5), @Now, 108)
    GROUP BY [LocalUserId]
) AS [avgCView]
ON [iDetails].[ICUserID] = [avgCView].[UserId]


-- Only use agents which have been activ TODAY.
WHERE [ICUserID] IN (SELECT * FROM @ActiveAgents)
