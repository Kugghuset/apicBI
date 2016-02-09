
-- Will be set in JavaScript
-- DECLARE @LastUpdate DateTime2 = '2016-01-25 00:00'


-- Filter variables
DECLARE @Now DateTime2 = GETDATE()
DECLARE @StartOfToday DateTime2 = DATEADD(day, DATEDIFF(day, 0, @Now), 0)
DECLARE @StartOfWeek DateTime2 = DATEADD(ww, DATEDIFF(ww, 1, @Now), 0)

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
    AND [ConnectedDate] > @StartOfWeek
    AND [TerminatedDateTimeGMT] > @LastUpdate
    AND [AssignedWorkGroup] = 'CSA'
GROUP BY [LocalUserId]

/*
 * Declaration of a call table where most columns are stripped out.
 * This is used to significantly reduce the query time by
 * only doing the complex comparisons on a subset of the complete table.
*/
DECLARE @ThisWeeksCalls TABLE (
    [LocalUserId] VarChar(255) NULL
  , [CallDurationSeconds] Int NULL
  , [ConnectedDate] DateTime2 NULL
  , [TerminatedDate] DateTime2 NULL
  , [TerminatedDateTimeGMT] DateTime2 NULL
  , [tQueueWaitSeconds] Int NULL
  , [AssignedWorkGroup] nvarchar(100) NULL
)
-- Populate @ThisWeeksCalls
INSERT INTO @ThisWeeksCalls
SELECT [LocalUserId]
     , [CallDurationSeconds]
     , [ConnectedDate]
     , [TerminatedDate]
     , [TerminatedDateTimeGMT]
     , [tQueueWait] / 1000
     , [AssignedWorkGroup]
FROM [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [CallDirection] = 'Inbound'
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'
  AND [ConnectedDate] > @StartOfWeek
  AND [TerminatedDateTimeGMT] > @LastUpdate
  AND [CallType] != 'Intercom'
  AND [AssignedWorkGroup] = 'CSA'
  AND [LocalUserId] IN (SELECT * FROM @ActiveAgents)

/***************************************************************************
 * Selects all agents which have been active today.
 *
 * Output per row:
 * [Agent]                                      Name of the agent
 * [Call duration in seconds]                   The call length in seconds
 * [Call duration in minutes]                   The call length in minutes
 * [Waiting time in seconds]                    The waiting time in seconds
 * [Waiting time in minutes]                    The waiting time in minutes
 * [Is under 60]                                100 or 0 for whether the waiting time is under 60 or not
 * [Nullable waiting time]                      The call length if it's below 60, otherwise NULL
 * [Date connected]                             The time of the agent answering
 * [Date disconnected]                          The time of the agent disconnecting the call
 * [TerminatedDateTimeGMT]                      The time of insert of the row
 * [Work group]                                    Name of the work group which has to be CSA
***************************************************************************/
SELECT [iDetails].[FirstName] + ' ' + [iDetails].[LastName] AS [Agent]
     , [cView].[CallDurationSeconds] AS [Call duration in seconds]
     , CAST(ROUND(([cView].[CallDurationSeconds] + 0.0) / 60, 2) AS Float) AS [Call duration in minutes]
     , [cView].[tQueueWaitSeconds] AS [Waiting time in seconds]
     , CAST(ROUND(([cView].[tQueueWaitSeconds] + 0.0) / 60 , 2) AS Float) AS [Waiting time in minutes]
     , CASE
        WHEN [cView].[tQueueWaitSeconds] < 60 THEN 100
        ELSE 0
      END AS [Is under 60]
     , CASE
        WHEN [cView].[tQueueWaitSeconds] < 60 THEN ([cView].[tQueueWaitSeconds])
        ELSE NULL
      END AS [Nullable waiting time]
     , [cView].[ConnectedDate] AS [Date connected]
     , [cView].[TerminatedDate] AS [Date disconnected]
     , [cView].[TerminatedDateTimeGMT]
     , [cView].[AssignedWorkGroup] AS [Work group]
FROM [SP_I3_IC].[dbo].[IndivDetails] AS [iDetails]

/*
 * Left join for the [Average call duration today] and [Total calls today]
*/
LEFT JOIN (
    SELECT [LocalUserId] AS [UserId]
         , [CallDurationSeconds]
         , [tQueueWaitSeconds]
         , [ConnectedDate]
         , [TerminatedDate]
         , [TerminatedDateTimeGMT]
         , [AssignedWorkGroup]
    FROM @ThisWeeksCalls
    WHERE [TerminatedDateTimeGMT] > @LastUpdate
    ) AS [cView]
ON [iDetails].[ICUserID] = [cView].[UserId]

-- Only use agents which have been active TODAY.
WHERE [ICUserID] IN (SELECT * FROM @ActiveAgents)
ORDER BY [TerminatedDateTimeGMT] DESC