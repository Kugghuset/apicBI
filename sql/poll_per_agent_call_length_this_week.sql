
-- Will be set in JavaScript
-- DECLARE @LastUpdate DateTime2 = '2016-01-18 00:00'

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
    AND [I3TimeStampGMT] > @LastUpdate
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
  , [I3TimeStampGMT] DateTime2 NULL
  , [tQueueWait] Int NULL
)
-- Populate @ThisWeeksCalls
INSERT INTO @ThisWeeksCalls
SELECT [LocalUserId]
     , [CallDurationSeconds]
     , [ConnectedDate]
     , [TerminatedDate]
     , [I3TimeStampGMT]
     , [tQueueWait]
FROM [SP_I3_IC].[dbo].[calldetail_viw]
WHERE [CallDirection] = 'Inbound'
  AND [ConnectedDate] != '1970-01-01 01:00:00.000'
  AND [ConnectedDate] > @StartOfWeek
  AND [I3TimeStampGMT] > @LastUpdate
  AND [LocalUserId] IN (SELECT * FROM @ActiveAgents)

/***************************************************************************
 * Selects all agents which have been active today.
 *
 * Output per row:
 * [Agent]                                      Name of the agent
 * [Call duration in seconds]                   The call length in seconds
 * [Waiting time in seconds]                    The waiting time in seconds
 * [Is under 60]                                Boolean value for whether the call length is under 60 or not
 * [Nullable call duration]						The call length if it's below 60, otherwise NULL
 * [Date connected]                             The time of the agent answering
 * [Date disconnected]                          The time of the agent disconnecting the call
 * [I3TimeStampGMT]                             The time of insert of the row
***************************************************************************/
SELECT [iDetails].[FirstName] + ' ' + [iDetails].[LastName] AS [Agent]
     , [cView].[CallDurationSeconds] AS [Call duration in seconds]
     , [cView].[tQueueWait] / 1000 AS [Waiting time in seconds]
	 , CASE
        WHEN [cView].[CallDurationSeconds] < 60 THEN 1
        ELSE 0
      END AS [Is under 60]
	 , CASE
        WHEN [cView].[CallDurationSeconds] < 60 THEN [cView].[CallDurationSeconds]
        ELSE NULL
      END AS [Nullable call duration]
     , [cView].[ConnectedDate] AS [Date connected]
     , [cView].[TerminatedDate] AS [Date disconnected]
     , [cView].[I3TimeStampGMT]
FROM [SP_I3_IC].[dbo].[IndivDetails] AS [iDetails]

/*
 * Left join for the [Average call duration today] and [Total calls today]
*/
LEFT JOIN (
    SELECT [LocalUserId] AS [UserId]
         , [CallDurationSeconds]
         , [tQueueWait]
         , [ConnectedDate]
         , [TerminatedDate]
         , [I3TimeStampGMT]
    FROM @ThisWeeksCalls
    WHERE [I3TimeStampGMT] > @LastUpdate
    ) AS [cView]
ON [iDetails].[ICUserID] = [cView].[UserId]

-- Only use agents which have been active TODAY.
WHERE [ICUserID] IN (SELECT * FROM @ActiveAgents)
ORDER BY [I3TimeStampGMT] DESC